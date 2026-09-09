import frappe
from frappe.utils import cint


# ==========================================
# 1. TENDERS API
# ==========================================
@frappe.whitelist(allow_guest=False)
def get_tenders(page=1, page_size=15, search=None, sector=None, state=None, status=None, source_name=None, **kwargs):
    filters = {}
    
    if sector: filters["sector"] = sector
    if state: filters["state"] = state
    if source_name: filters["source_name"] = source_name
    
    year = kwargs.get("year")
    year_mode = kwargs.get("yearMode", "close")
    if year:
        date_field = "close_date" if year_mode == "close" else "published_date"
        filters[date_field] = ["between", [f"{year}-01-01", f"{year}-12-31"]]
    
    requested_status = "open"
    if status:
        clean = str(status).lower()
        if 'upcoming' in clean:
            requested_status = "upcoming"
            filters["status"] = ["in", ["upcoming", "Upcoming", "pursued", "Pursued"]]
        elif 'closed' in clean:
            requested_status = "closed"
            filters["status"] = ["in", [
                "closed", "Closed", 
                "won", "Won", 
                "lost", "Lost", 
                "awarded", "Awarded", 
                "withdrawn", "Withdrawn"
            ]]
        else:
            requested_status = "open"
            filters["status"] = ["in", ["open", "Open", "active", "Active"]]
            
    if search: filters["title"] = ["like", f"%{search}%"]

    page = cint(page) if cint(page) > 0 else 1
    page_size = cint(page_size) if cint(page_size) > 0 else 15
    start = (page - 1) * page_size

    sort_f = kwargs.get("sort_field") or kwargs.get("sortField") or kwargs.get("sort_by")
    if not sort_f or str(sort_f) in ["created_at", "undefined", "null", "", "default"]:
        sort_f = "creation"
        
    sort_d = kwargs.get("sort_direction") or kwargs.get("sortDirection") or kwargs.get("order")
    if not sort_d or str(sort_d).lower() not in ["asc", "desc"]:
        sort_d = "desc"

    try:
        tenders = frappe.get_all(
            "War Room Tender",
            filters=filters,
            fields=["name as id", "title", "agency", "contract_value", "sector", "state", "status", "close_date", "published_date", "source_name", "source_id", "source_url", "creation as created_at"],
            limit_start=start,
            limit_page_length=page_size,
            order_by=f"`{sort_f}` {sort_d}"
        )
    except frappe.ValidationError as e:
        frappe.logger().error(f"Tender Sort Failed: {e!s}")
        tenders = frappe.get_all(
            "War Room Tender",
            filters=filters,
            fields=["name as id", "title", "agency", "contract_value", "sector", "state", "status", "close_date", "published_date", "source_name", "source_id", "source_url", "creation as created_at"],
            limit_start=start,
            limit_page_length=page_size,
            order_by="creation desc"
        )

    for t in tenders:
        t["status"] = requested_status

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
    
    active = frappe.db.count("War Room Tender", {"status": ["in", ["open", "Open", "active", "Active"]]})
    upcoming = frappe.db.count("War Room Tender", {"status": ["in", ["upcoming", "Upcoming", "pursued", "Pursued"]]})
    closed = frappe.db.count("War Room Tender", {"status": ["in", [
        "closed", "Closed", 
        "won", "Won", 
        "lost", "Lost", 
        "awarded", "Awarded", 
        "withdrawn", "Withdrawn"
    ]]})

    val = frappe.db.sql("""
        SELECT SUM(contract_value) as total_value, AVG(contract_value) as avg_value 
        FROM `tabWar Room Tender`
    """, as_dict=True)[0]

    return {
        "total_tenders": total,
        "active_tenders": active,
        "upcoming_tenders": upcoming,
        "closed_tenders": closed,
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
    clean_sector = None
    if sector and str(sector).lower() != "all":
        clean_sector = str(sector)
        
    clean_state = None
    if state and str(state).lower() != "all":
        clean_state = str(state).upper()

    try:
        clean_min = float(min_value) if min_value else 0.0
        clean_max = float(max_value) if max_value else 0.0
    except (ValueError, TypeError):
        clean_min = 0.0
        clean_max = 0.0

    doc = frappe.get_doc({
        "doctype": "War Room Saved Search",
        "search_name": name,
        "sector": clean_sector,
        "state": clean_state,
        "min_value": clean_min,
        "max_value": clean_max,
        "notifications": 1 if notifications else 0,
        "match_count": 0,
        "last_matched": None
    })

    sector_map = {
        "cleaning": "Cleaning",
        "construction": "Construction",
        "facility_management": "Facility Mgmt",
        "it_services": "IT Services",
        "healthcare": "Healthcare",
        "transportation": "Transportation",
        "other": "Other",
        "all_sectors": "All Sectors"
    }

    if doc.sector in sector_map:
        doc.sector = sector_map[doc.sector]

    doc.insert()
    return doc.as_dict()

# ==========================================
# 4. BID TRACKER INTEGRATION (THE BRIDGE)
# ==========================================
@frappe.whitelist(allow_guest=False)
def pursue_tender(tender_id):
    if not frappe.db.exists("War Room Tender", tender_id):
        frappe.throw("Tender not found", frappe.DoesNotExistError)
        
    tender = frappe.get_doc("War Room Tender", tender_id)
    
    existing_bid = frappe.db.exists("Bid Record", {"war_room_reference": tender.name})
    if existing_bid:
        return {"status": "error", "message": "A Bid Record already exists for this tender.", "bid_id": existing_bid}

    new_bid = frappe.get_doc({
        "doctype": "Bid Record",
        "bid_name": tender.title,
        "client_name": tender.agency, 
        "sector": tender.sector,
        "estimated_value": tender.contract_value,
        "submission_deadline": tender.close_date,
        "war_room_reference": tender.name,
        "bid_status": "Draft"
    })
    
    new_bid.insert(ignore_permissions=True)
    frappe.db.set_value("War Room Tender", tender.name, "status", "pursued")
    frappe.db.commit()

    return {"status": "success", "new_bid_id": new_bid.name}