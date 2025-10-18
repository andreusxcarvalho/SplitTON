# Use Gunicorn to serve the Flask app (web service for Mini App API)
web: gunicorn --chdir backend server:app 

# Use a worker dyno to run the Telegram bot polling process
worker: python backend/bot.py