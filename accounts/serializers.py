from django.contrib.contenttypes.models import ContentType
from rest_framework import serializers
from django.contrib.auth.models import User, Permission, Group
from accounts.models import userstatus, userprofile, notification
from commons.serializers import MenuGroupSerializer


class userstatusSerializer(serializers.ModelSerializer):
    menugroup = MenuGroupSerializer(read_only=True)

    class Meta:
        model = userstatus
        fields = '__all__'


class userprofileSerializer(serializers.ModelSerializer):

    class Meta:
        model = userprofile
        fields = '__all__'


class userSerializer(serializers.ModelSerializer):
    date_joined = serializers.DateTimeField(format='%Y-%m-%d %H:%M:%S', read_only=True)
    last_login = serializers.DateTimeField(format='%Y-%m-%d %H:%M:%S', read_only=True)
    userstatus = userstatusSerializer(read_only=True)
    userprofile = userprofileSerializer(read_only=True)
    group = serializers.SerializerMethodField()

    class Meta:
        model = User
        # fields = '__all__'
        fields = ('id', 'username', 'password', 'first_name', 'email', 'is_superuser', 'is_staff', 'is_active', 'date_joined', 'last_login', 'userstatus', 'userprofile', 'group')

    def get_group(self, obj):
        """取得使用者所屬的群組（限定一個）"""
        group = obj.groups.first()
        return {'id': group.id, 'name': group.name} if group else None


class ContentTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentType
        fields = "__all__"


class PermissionSerializer(serializers.ModelSerializer):
    content_type = ContentTypeSerializer(read_only=True)

    class Meta:
        model = Permission
        fields = "__all__"


class GroupSerializer(serializers.ModelSerializer):
    permissions = PermissionSerializer(many=True, read_only=True)
    users = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = ['id', 'name', 'permissions', 'users']

    def get_users(self, obj):
        return [{'id': u.id, 'username': u.first_name or u.username, 'first_name': u.first_name, 'email': u.email} for u in obj.user_set.all()]


class NotificationSerializer(serializers.ModelSerializer):
    create_date = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S", read_only=True)
    notifier_username = serializers.SerializerMethodField()

    class Meta:
        model = notification
        fields = ('id', 'create_date', 'notifier_username', 'message', 'is_read')

    def get_notifier_username(self, obj):
        """顯示 first_name，若無則顯示 username"""
        return obj.notifier.first_name or obj.notifier.username
