from django.shortcuts import render
from django.template.response import TemplateResponse
from django.http.response import HttpResponse
from django.contrib.auth.decorators import login_required
import logging

from commons.models import menu, menugroup

logger = logging.getLogger("django")


# Create your views here.

@login_required
def parameterlist(request):
    username = request.user.first_name
    html = TemplateResponse(
        request, "commons/parameterlist.html", {"username": username}
    )
    return HttpResponse(html.render())


@login_required
def menulist(request):
    qsMenu = menu.objects.values('menu_1st', 'menu_1st_icon', 'menu_1st_sort').distinct().order_by("menu_1st_sort")
    context = {"qsMenu": qsMenu}
    return render(request, "commons/menulist.html", context)


@login_required
def menugrouplist(request):
    qsMenu = menu.objects.all().order_by("menu_1st_sort", "menu_2st_sort")
    context = {"qsMenu": qsMenu}
    return render(request, "commons/menugrouplist.html", context)

