# Локальный запуск на рабочем компьютере Windows

Этот вариант запускает приложение только на вашем рабочем компьютере. Публичной ссылки не будет. Адрес будет локальный:

```text
http://localhost:5000
```

## 1. Установить Python

Установите Python 3.11 или 3.12 с официального сайта Python. При установке отметьте пункт **Add Python to PATH**.

## 2. Скачать проект

Откройте репозиторий:

```text
https://github.com/snklukin-commits/BDR/tree/main/email_ai_app
```

Скачайте папку проекта или весь репозиторий.

## 3. Создать файл `.env`

В папке `email_ai_app` создайте файл `.env` по образцу `.env.example`.

Минимальная настройка:

```env
IMAP_HOST=mx03.bsspharm.ru
IMAP_PORT=993
IMAP_USE_SSL=true
SMTP_HOST=mx03.bsspharm.ru
SMTP_PORT=587
SMTP_STARTTLS=true
MAIL_USER=ВАШ_ЛОГИН_ПОЧТЫ
MAIL_PASSWORD=ВАШ_ПАРОЛЬ_ПОЧТЫ
MAIL_FROM=ВАШ_ЛОГИН_ПОЧТЫ
OPENAI_API_KEY=ВАШ_OPENAI_API_KEY
OPENAI_MODEL=gpt-4o-mini
CHECK_INTERVAL_SECONDS=300
MAX_EMAILS_PER_CHECK=30
AUTO_EMAIL_REPORT_ENABLED=false
AUTO_EMAIL_REPORT_TO=
DB_PATH=mail_ai.sqlite3
```

Файл `.env` не нужно загружать в GitHub. Он добавлен в `.gitignore`.

## 4. Запустить

Дважды нажмите:

```text
run_windows.bat
```

Или выполните в терминале:

```bat
cd email_ai_app
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

После запуска откройте:

```text
http://localhost:5000
```

## 5. Чтобы работало автоматически

Компьютер должен быть включён. Сон нужно отключить.

Можно:

- выключать экран;
- блокировать Windows;
- оставлять приложение запущенным.

Нельзя:

- переводить компьютер в сон;
- выключать компьютер;
- закрывать окно с приложением.

## 6. Автозапуск через Планировщик заданий Windows

1. Откройте **Планировщик заданий**.
2. Создайте простую задачу.
3. Триггер: **При входе в Windows**.
4. Действие: **Запустить программу**.
5. Программа: путь к `run_windows.bat`.
6. В свойствах задачи включите: **Выполнять независимо от входа пользователя**, если доступно.

## 7. Безопасность

- Пароль рабочей почты хранится только локально в `.env` на вашем компьютере.
- Не отправляйте `.env` в GitHub и никому не пересылайте.
- Если компьютер общий, лучше не использовать этот вариант без отдельной учётной записи Windows.
