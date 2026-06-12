from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required

@login_required()
def index(request):
    return redirect("ithelps:repair_list")
    #return redirect("dreams:dream-list_v2")