from collections import defaultdict

from django.db.models import Q
from model_utils import Choices
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from form_manager.models import form_template
from form_manager.serializers import FormTemplateSerializer


class FormTemplateViewSet(viewsets.ModelViewSet):
    queryset = form_template
    permission_classes = [IsAuthenticated]
    serializer_class = FormTemplateSerializer

    def __query_by_args(self, **kwargs):
        ORDER_COLUMN_CHOICES = Choices(
            ("0", "id"),
            ("1", "username"),
            ("2", "password"),
            ("3", "first_name"),
            ("4", "email"),
            ("6", "is_active"),
            ("7", "last_login"),
            ("9", "is_staff"),
        )
        draw: int = int(kwargs.get("draw", None)[0])
        length: int = int(kwargs.get("length", None)[0])
        start: int = int(kwargs.get("start", None)[0])
        search_value: str = kwargs.get("search[value]", None)[0]
        order_column: str = kwargs.get("order[0][column]", None)[0]
        order: str = kwargs.get("order[0][dir]", None)[0]

        order_column = ORDER_COLUMN_CHOICES[order_column]
        # django orm '-' -> desc
        if order == "desc":
            order_column = "-" + order_column

        queryset = form_template.objects.filter()
        total = queryset.count()

        if search_value:
            queryset = queryset.filter(
                Q(username__icontains=search_value)
                | Q(email__icontains=search_value)
                | Q(is_staff__icontains=search_value)
                | Q(is_active__icontains=search_value)
            )

        count = queryset.count()
        queryset = queryset.order_by(order_column)[start : start + length]
        return {"items": queryset, "count": count, "total": total, "draw": draw}

    def list(self, request, **kwargs):
        try:
            data = self.__query_by_args(**request.query_params)
            serializer = self.get_serializer(data["items"], many=True)
            result = defaultdict()
            result["data"] = serializer.data
            result["draw"] = data["draw"]
            result["recordsTotal"] = data["total"]
            result["recordsFiltered"] = data["count"]
            return Response(
                result, status=status.HTTP_200_OK, template_name=None, content_type=None
            )

        except Exception as e:
            return Response(
                e,
                status=status.HTTP_404_NOT_FOUND,
                template_name=None,
                content_type=None,
            )

    def create(self, request, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
