import frappe
from frappe.model.document import Document

class WarRoomTender(Document):
    def on_update(self):
        # Trigger only if the date changed AND it has already been pursued (has a lead_id)
        if self.has_value_changed("close_date") and self.get("lead_id"):
            
            # Find the calendar event by looking for the Lead ID we injected into the description
            events = frappe.get_all(
                "Event", 
                filters={"description": ["like", f"%Lead: {self.lead_id}%"]}
            )
            
            for e in events:
                # Update the existing event's start date
                frappe.db.set_value("Event", e.name, "starts_on", self.close_date)