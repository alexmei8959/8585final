from django.urls import path, include
from rest_framework.routers import SimpleRouter

from form_manager.views import form_template_view
from form_manager.viewsets import FormTemplateViewSet

app_name = "form_manager"

router = SimpleRouter()
router.register("_form_template", FormTemplateViewSet, basename="_form_template")
urlpatterns = [
    path("", include(router.urls)),
    path("form_template", form_template_view, name="form_template"),
]
