# AI‑почта для BSS / mx03.bsspharm.ru

Серверный почтовый помощник для рабочего ящика с IMAP/SMTP:

- читает новые письма через IMAP `mx03.bsspharm.ru:993 SSL/TLS`;
- хранит письма локально в SQLite;
- извлекает текст из PDF, DOCX, XLSX, TXT, CSV;
- делает сводку письма;
- генерирует рекомендуемый ответ;
- отправляет ответ через SMTP `mx03.bsspharm.ru:587 STARTTLS` только после ручного нажатия;
- может автоматически проверять почту и отправлять отчёт на указанный адрес.

## Важное ограничение

Подписка ChatGPT Plus/Pro не даёт API‑ключ для стороннего приложения. Для работы ИИ нужен `OPENAI_API_KEY`.

Пароль от почты и API‑ключ нельзя коммитить в GitHub. Они задаются только в `.env` локально или в переменных окружения хостинга.

## Локальный запуск

```bash
cd email_ai_app
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python app.py
```

После запуска:

```text
http://localhost:5000
```

## Настройка `.env`

```env
IMAP_HOST=mx03.bsspharm.ru
IMAP_PORT=993
IMAP_USE_SSL=true
SMTP_HOST=mx03.bsspharm.ru
SMTP_PORT=587
SMTP_STARTTLS=true
MAIL_USER=your_work_email_login
MAIL_PASSWORD=your_work_email_password
MAIL_FROM=your_work_email_login
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
CHECK_INTERVAL_SECONDS=300
```

## Автоматические отчёты

Включить отправку отчёта на почту после появления новых сообщений:

```env
AUTO_EMAIL_REPORT_ENABLED=true
AUTO_EMAIL_REPORT_TO=your_personal_email@example.com
```

## Развёртывание

В репозитории есть `render.yaml`. Можно развернуть на Render как Web Service и задать секреты в панели Render:

- `MAIL_USER`
- `MAIL_PASSWORD`
- `MAIL_FROM`
- `OPENAI_API_KEY`

После деплоя Render выдаст ссылку вида:

```text
https://bss-mail-ai.onrender.com
```

Это и будет ссылка на готовый продукт для теста.

## Что приложение не делает

- Не использует пароль, зашитый в код.
- Не обходит веб-интерфейс `bssmail.ru/#/mailbox`.
- Не работает без сервера или запущенного локального процесса.
- Не может использовать ChatGPT Plus/Pro как API.
