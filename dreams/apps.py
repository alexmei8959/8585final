from django.apps import AppConfig


class DreamsConfig(AppConfig):
    name = 'dreams'

    def ready(self):
        import dreams.signals  # noqa: F401
