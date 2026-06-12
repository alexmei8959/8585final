from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .models import dream, dream_image
from .search import index_dream, delete_dream


@receiver(post_save, sender=dream)
def on_dream_save(sender, instance, **kwargs):
    index_dream(instance)


@receiver(post_delete, sender=dream)
def on_dream_delete(sender, instance, **kwargs):
    delete_dream(instance.id)


@receiver(post_delete, sender=dream_image)
def delete_dream_image_file(sender, instance, **kwargs):
    if instance.image:
        instance.image.delete(save=False)
