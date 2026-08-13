import frappe
from frappe.utils import cint

# ==========================================
# 1. TENDERS API
# ==========================================

@frappe.whitelist(allow_guest=False)
def get_tenders(page=1, page_size=15, search=None, sector=None, state=None, status=None):
    filters = {}
    
    if sector: filters["sector"] = sector
    if state: filters["state"] = state
    if status and status != 'all': filters["status"] = status
    if search: filters["title"] = ["like", f"%{search}%"]

    page = cint(page)
    page_size = cint(page_size)
    start = (page - 1) * page_size

    tenders = frappe.get_all(
        "War Room Tender",
        filters=filters,
        fields=["name as id", "title", "agency", "contract_value", "sector", "state", "status", "close_date", "published_date", "source_name", "source_id", "source_url"],
        limit_start=start,
        limit_page_length=page_size,
        order_by="creation desc"
    )

    return {
        "items": tenders,
        "total": frappe.db.count("War Room Tender", filters=filters),
        "page": page,
        "page_size": page_size
    }

@frappe.whitelist(allow_guest=False)
def get_tender_by_id(id):
    if not frappe.db.exists("War Room Tender", id):
        frappe.throw("Tender not found", frappe.DoesNotExistError)
    return frappe.get_doc("War Room Tender", id).as_dict()


# ==========================================
# 2. STATS & ANALYTICS API
# ==========================================

@frappe.whitelist(allow_guest=False)
def get_overview_stats():
    total = frappe.db.count("War Room Tender")
    active = frappe.db.count("War Room Tender", {"status": "open"})
    val = frappe.db.sql("""
        SELECT SUM(contract_value) as total_value, AVG(contract_value) as avg_value 
        FROM `tabWar Room Tender`
    """, as_dict=True)[0]

    return {
        "total_tenders": total,
        "active_tenders": active,
        "total_value": val.total_value or 0,
        "avg_value": val.avg_value or 0
    }

@frappe.whitelist(allow_guest=False)
def get_source_stats():
    return {"sources": {}}

@frappe.whitelist(allow_guest=False)
def get_sector_stats():
    return []

@frappe.whitelist(allow_guest=False)
def get_state_stats():
    return []


# ==========================================
# 3. ALERTS & SAVED SEARCHES API
# ==========================================

@frappe.whitelist(allow_guest=False)
def get_alerts():
    return frappe.get_all(
        "War Room Alert", 
        fields=["name as id", "title", "description", "type", "priority", "read", "creation as created_at"], 
        order_by="creation desc"
    )

@frappe.whitelist(allow_guest=False)
def mark_read(id):
    frappe.db.set_value("War Room Alert", id, "read", 1)
    return "success"

@frappe.whitelist(allow_guest=False)
def mark_all_read():
    frappe.db.sql("""UPDATE `tabWar Room Alert` SET `read`=1 WHERE `read`=0""")
    frappe.db.commit()
    return "success"

@frappe.whitelist(allow_guest=False)
def delete_alert(id):
    frappe.delete_doc("War Room Alert", id)
    return "success"

@frappe.whitelist(allow_guest=False)
def get_saved_searches():
    return frappe.get_all(
        "War Room Saved Search", 
        fields=["name as id", "search_name as name", "sector", "state", "min_value", "max_value", "notifications", "match_count", "last_matched", "creation as created_at"], 
        order_by="creation desc"
    )

@frappe.whitelist(allow_guest=False)
def delete_saved_search(id):
    frappe.delete_doc("War Room Saved Search", id)
    return "success"

@frappe.whitelist(allow_guest=False)
def toggle_saved_search(id):
    current_status = frappe.db.get_value("War Room Saved Search", id, "notifications")
    frappe.db.set_value("War Room Saved Search", id, "notifications", 0 if current_status else 1)
    return "success"

@frappe.whitelist(allow_guest=False)
def create_alert(title, description=None, type=None, priority=None):
    doc = frappe.get_doc({
        "doctype": "War Room Alert",
        "title": title,
        "description": description,
        "type": type or "system",
        "priority": priority or "medium"
    })
    doc.insert()
    return doc.as_dict()

@frappe.whitelist(allow_guest=False)
def create_saved_search(name, sector=None, state=None, min_value=0, max_value=0, notifications=1):
    doc = frappe.get_doc({
        "doctype": "War Room Saved Search",
        "search_name": name,
        "sector": sector,
        "state": state,
        "min_value": min_value,
        "max_value": max_value,
        "notifications": 1 if notifications else 0,
        "match_count": 0,           
        "last_matched": None
    })
    doc.insert()
    return doc.as_dict()