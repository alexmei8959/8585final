from Dreamstream.serializers import UanModelSerializer
from commons.models import parameter, menugroup, menu


class ParameterSerializer(UanModelSerializer):
    class Meta:
        model = parameter
        fields = "__all__"


class MenuSerializer(UanModelSerializer):
    class Meta:
        model = menu
        fields = "__all__"


class MenuGroupSerializer(UanModelSerializer):
    class Meta:
        model = menugroup
        fields = "__all__"

