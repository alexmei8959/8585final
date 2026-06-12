from Dreamstream.serializers import UanModelSerializer
from form_manager.models import form_template


class FormTemplateSerializer(UanModelSerializer):
    class Meta:
        model = form_template
        fields = "__all__"
