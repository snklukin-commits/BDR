"""
Простое веб‑приложение для работы с почтой и интеграцией ИИ.

Сервис использует IMAP для чтения входящих сообщений и SMTP (опционально) для отправки писем.
Он подключается к большому языковому модели через API (например, OpenAI), чтобы генерировать
рекомендованные ответы и резюмировать содержимое писем и вложений. Для экономии ресурсов 
и безопасности реального ИИ‑модели в данном примере вызовы модели заглушены и возвращают 
демонстрационную строку. Чтобы получить полноценную функциональность, добавьте реальный API‑ключ 
и раскомментируйте соответствующий код.

Файл .env должен содержать переменные:

IMAP_HOST=<адрес сервера>
IMAP_PORT=<порт, обычно 993>
EMAIL_USER=<имя пользователя>
EMAIL_PASSWORD=<пароль>
OPENAI_API_KEY=<ключ для OpenAI>

Для запуска:
    pip install -r requirements.txt
    python app.py

После запуска приложение будет доступно на http://localhost:5000.
"""

import os
import threading
import time
import email
import imaplib
from email.header import decode_header, make_header
from flask import Flask, jsonify, request, render_template_string
from flask_socketio import SocketIO, emit
from dotenv import load_dotenv

try:
    import openai
except ImportError:
    openai = None  # библиотека не установлена


load_dotenv()

# Настройки IMAP из переменных окружения
IMAP_HOST = os.getenv("IMAP_HOST")
IMAP_PORT = int(os.getenv("IMAP_PORT", "993"))
EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")

# Создание Flask приложения и SocketIO
app = Flask(__name__)
socketio = SocketIO(app, async_mode="threading")

# Хранилище писем (для примера)
emails_cache = []

# Шаблон главной страницы (упрощенный)
INDEX_HTML = """
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>AI‑почта</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; }
      #emails { display: flex; flex-direction: column; max-width: 600px; margin-bottom: 2rem; }
      .email-item { border: 1px solid #ddd; padding: 10px; margin-bottom: 5px; }
      .email-item:hover { background: #f9f9f9; cursor: pointer; }
    </style>
</head>
<body>
  <h1>Ваши письма</h1>
  <div id="emails"></div>
  <div id="details"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.5/socket.io.min.js" integrity="sha512-umrWNmFbyCO/GxE1WChqhT0SMZon7Xig0wtREoI1rGZCjFVtIZXFCJEvWBfxH51L1xQpRH8gZWFRwVWQf4MDSQ==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
  <script>
    const socket = io();
    // Получение обновлений о новых письмах
    socket.on('new_email', (data) => {
        console.log('Новое письмо', data);
        loadEmails();
    });

    // Загрузка писем
    async function loadEmails() {
        const response = await fetch('/api/emails');
        const data = await response.json();
        const container = document.getElementById('emails');
        container.innerHTML = '';
        data.forEach((mail, index) => {
            const div = document.createElement('div');
            div.className = 'email-item';
            div.innerText = `${mail.subject} — ${mail.from}`;
            div.onclick = () => loadEmail(index);
            container.appendChild(div);
        });
    }

    // Загрузка конкретного письма и предложенных ответов
    async function loadEmail(index) {
        const response = await fetch('/api/email/' + index);
        const mail = await response.json();
        const details = document.getElementById('details');
        details.innerHTML = `<h2>${mail.subject}</h2><p><strong>От:</strong> ${mail.from}</p><p>${mail.body}</p>`;
        // Запросить рекомендации
        const resp = await fetch('/api/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: mail.body }) });
        const rec = await resp.json();
        details.innerHTML += `<h3>Рекомендованные ответы</h3><pre>${rec.recommendation}</pre>`;
    }

    // Первая загрузка
    loadEmails();
  </script>
</body>
</html>
"""


def connect_imap():
    """Подключение к IMAP серверу."""
    imap = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
    imap.login(EMAIL_USER, EMAIL_PASSWORD)
    return imap


def fetch_unseen_emails():
    """Проверяет входящие сообщения и возвращает новые письма."""
    try:
        imap = connect_imap()
    except Exception as e:
        print("Ошибка подключения к IMAP:", e)
        return []
    status, _ = imap.select("INBOX")
    if status != 'OK':
        return []
    # Поиск непрочитанных
    status, messages = imap.search(None, "UNSEEN")
    new_messages = []
    if status == 'OK':
        for num in messages[0].split():
            res, data = imap.fetch(num, '(RFC822)')
            if res != 'OK':
                continue
            msg = email.message_from_bytes(data[0][1])
            subject = str(make_header(decode_header(msg.get("Subject"))))
            sender = str(make_header(decode_header(msg.get("From"))))
            body = ""
            if msg.is_multipart():
                for part in msg.walk():
                    ctype = part.get_content_type()
                    if ctype == 'text/plain' and part.get_content_disposition() is None:
                        body = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                        break
            else:
                body = msg.get_payload(decode=True).decode('utf-8', errors='ignore')
            # Вложения
            attachments = []
            for part in msg.walk():
                if part.get_content_disposition() == 'attachment':
                    filename = part.get_filename()
                    content = part.get_payload(decode=True)
                    attachments.append({'filename': filename, 'content': content})
            new_messages.append({'subject': subject, 'from': sender, 'body': body, 'attachments': attachments})
            # Помечаем как прочитанное
            imap.store(num, '+FLAGS', '\\Seen')
    imap.close()
    imap.logout()
    return new_messages


def background_checker():
    """Фоновый поток для проверки новых писем."""
    while True:
        global emails_cache
        new_emails = fetch_unseen_emails()
        if new_emails:
            emails_cache.extend(new_emails)
            # Отправляем уведомление через SocketIO
            socketio.emit('new_email', {'count': len(new_emails)})
        time.sleep(30)  # проверка каждые 30 секунд


def generate_reply_suggestion(body: str) -> str:
    """Генерирует рекомендованный ответ с помощью ИИ. Возвращает строку."""
    # Если доступна библиотека openai и есть ключ, можно использовать реальную модель
    api_key = os.getenv('OPENAI_API_KEY')
    if openai and api_key:
        openai.api_key = api_key
        try:
            completion = openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "Ты — помощник по переписке. Предложи краткий деловой ответ на входящее письмо."},
                    {"role": "user", "content": body[:4000]}  # урезаем длинные письма
                ],
                max_tokens=100
            )
            return completion.choices[0].message.content.strip()
        except Exception as e:
            return f"Ошибка вызова модели: {e}"
    # Заглушка, если API недоступен
    return "Спасибо за письмо. Мы рассмотрим ваш запрос и ответим в ближайшее время."


@app.route('/')
def index():
    return render_template_string(INDEX_HTML)


@app.route('/api/emails')
def get_emails():
    """Возвращает список полученных писем."""
    return jsonify([{'subject': mail['subject'], 'from': mail['from']} for mail in emails_cache])


@app.route('/api/email/<int:index>')
def get_email(index: int):
    if 0 <= index < len(emails_cache):
        mail = emails_cache[index]
        return jsonify({'subject': mail['subject'], 'from': mail['from'], 'body': mail['body']})
    return jsonify({'error': 'Письмо не найдено'}), 404


@app.route('/api/reply', methods=['POST'])
def get_reply():
    data = request.get_json()
    body = data.get('body', '') if data else ''
    reply = generate_reply_suggestion(body)
    return jsonify({'recommendation': reply})


def start_background_thread():
    thread = threading.Thread(target=background_checker, daemon=True)
    thread.start()


if __name__ == '__main__':
    # Запускаем фоновую проверку писем, если указаны параметры IMAP
    if IMAP_HOST and EMAIL_USER and EMAIL_PASSWORD:
        start_background_thread()
    else:
        print("IMAP настройки не указаны. Фоновая проверка отключена.")
    socketio.run(app, host='0.0.0.0', port=5000)
