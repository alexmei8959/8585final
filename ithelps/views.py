from datetime import datetime
import csv
from django.shortcuts import render, redirect, get_object_or_404
from django.db.models import Q
from django.core.paginator import Paginator
from django.http import HttpResponse
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from .forms import RepairForm
from .models import Ithelp, IthelpFile


def register(request):
    if request.method == "POST":
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect("ithelps:repair_list")
    else:
        form = UserCreationForm()
    return render(request, "registration/register.html", {"form": form})


@login_required
def export_repairs_csv(request):
    query = request.GET.get("q", "").strip()
    status_filter = request.GET.get("status", "").strip()

    # 💡 權限判斷：是管理員、職員，或 Email 為特定信箱者可導出全部
    if request.user.is_staff or request.user.is_superuser or request.user.email == "alex.yang@breadoflife.taipei":
        repairs = Ithelp.objects.all().order_by("-id")
    else:
        repairs = Ithelp.objects.filter(user=request.user).order_by("-id")

    if query:
        repairs = repairs.filter(
            Q(username__icontains=query)
            | Q(location__icontains=query)
            | Q(description__icontains=query)
            | Q(handler_name__icontains=query)
        ).distinct()

    if status_filter:
        repairs = repairs.filter(status=status_filter)

    filename = f"repair_export_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    response.write("\ufeff".encode("utf8"))

    writer = csv.writer(response)
    writer.writerow(["ID", "報修時間", "姓名", "地點", "故障描述", "狀態", "處理人", "處理備註"])

    for r in repairs:
        created_time = r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else ""
        writer.writerow([
            r.id, created_time, r.username, r.location,
            r.description, r.status, r.handler_name, r.resolution_notes
        ])

    return response


@login_required
def repair_edit(request, pk):
    # 💡 權限判斷：符合指定 Email 或管理員可編輯任何人的單
    if request.user.is_staff or request.user.is_superuser or request.user.email == "alex.yang@breadoflife.taipei":
        repair = get_object_or_404(Ithelp, pk=pk)
    else:
        repair = get_object_or_404(Ithelp, pk=pk, user=request.user)

    if request.method == "POST":
        form = RepairForm(request.POST, instance=repair)
        delete_files = request.POST.getlist("delete_files")
        if delete_files:
            IthelpFile.objects.filter(id__in=delete_files).delete()

        if form.is_valid():
            form.save()
            new_files = request.FILES.getlist("new_files")
            for f in new_files:
                IthelpFile.objects.create(ithelp=repair, file_path=f)
            return redirect("ithelps:repair_list")
    else:
        form = RepairForm(instance=repair)

    return render(request, "ithelps/repair_update_form.html", {"form": form, "repair": repair})


@login_required
def repair_delete(request, pk):
    # 💡 權限判斷：符合指定 Email 或管理員可刪除任何人的單
    if request.user.is_staff or request.user.is_superuser or request.user.email == "alex.yang@breadoflife.taipei":
        repair = get_object_or_404(Ithelp, pk=pk)
    else:
        repair = get_object_or_404(Ithelp, pk=pk, user=request.user)
        
    repair.delete()
    return redirect("ithelps:repair_list")


@login_required
def repair_list(request):
    # 💡 權限判斷：符合指定 Email 或管理員可看到所有人建立的報修單
    if request.user.is_staff or request.user.is_superuser or request.user.email == "alex.yang@breadoflife.taipei":
        repairs_list = Ithelp.objects.all().order_by("-id")
    else:
        repairs_list = Ithelp.objects.filter(user=request.user).order_by("-id")

    query = request.GET.get("q", "").strip()
    status_filter = request.GET.get("status", "").strip()

    if query:
        repairs_list = repairs_list.filter(
            Q(username__icontains=query)
            | Q(location__icontains=query)
            | Q(description__icontains=query)
            | Q(handler_name__icontains=query)
        ).distinct()

    if status_filter and status_filter != "":
        repairs_list = repairs_list.filter(status=status_filter)

    paginator = Paginator(repairs_list, 10)
    page_number = request.GET.get("page")
    repairs = paginator.get_page(page_number)

    return render(request, "ithelps/repair_list.html", {
        "repairs": repairs,
        "query": query,
        "status_filter": status_filter,
    })


@login_required
def repair_detail(request, pk):
    # 💡 權限判斷：符合指定 Email 或管理員可查看任何人的報修單細節
    if request.user.is_staff or request.user.is_superuser or request.user.email == "alex.yang@breadoflife.taipei":
        repair = get_object_or_404(Ithelp, pk=pk)
    else:
        repair = get_object_or_404(Ithelp, pk=pk, user=request.user)
        
    return render(request, "ithelps/repair_detail.html", {"repair": repair})


@login_required
def repair_create(request):
    if request.method == "POST":
        form = RepairForm(request.POST, request.FILES)
        if form.is_valid():
            repair = form.save(commit=False)
            repair.user = request.user
            repair.save()

            files = request.FILES.getlist("image")
            for f in files:
                IthelpFile.objects.create(ithelp=repair, file_path=f)

            return redirect("ithelps:repair_list")
    else:
        form = RepairForm()

    return render(request, "ithelps/repair_form.html", {"form": form})


@login_required
def repair_trash_bin(request):
    # 💡 權限判斷：符合指定 Email 或管理員可在回收桶看到所有人刪除的單
    if request.user.is_staff or request.user.is_superuser or request.user.email == "alex.yang@breadoflife.taipei":
        deleted_repairs = Ithelp.all_objects.filter(is_deleted=True).order_by("-deleted_at")
    else:
        deleted_repairs = Ithelp.all_objects.filter(is_deleted=True, user=request.user).order_by("-deleted_at")

    paginator = Paginator(deleted_repairs, 10)
    page_number = request.GET.get("page")
    repairs = paginator.get_page(page_number)

    return render(request, "ithelps/repair_trash_bin.html", {"repairs": repairs})


@login_required
def repair_restore(request, pk):
    # 💡 權限判斷：符合指定 Email 或管理員可還原任何人的單
    if request.user.is_staff or request.user.is_superuser or request.user.email == "alex.yang@breadoflife.taipei":
        repair = get_object_or_404(Ithelp.all_objects, pk=pk)
    else:
        repair = get_object_or_404(Ithelp.all_objects, pk=pk, user=request.user)

    if request.method == "POST":
        repair.is_deleted = False
        repair.deleted_at = None
        repair.save()
        return redirect("ithelps:repair_trash_bin")

    return redirect("ithelps:repair_trash_bin")