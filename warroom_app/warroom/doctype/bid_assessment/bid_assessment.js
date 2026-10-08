frappe.ui.form.on('Bid Assessment', {
    setup: function(frm) {
        frm.calculate_score = function() {

            if (frm.doc.strategy_score > 15) { 
                frappe.msgprint('Strategy cannot exceed 15 points'); 
                frm.set_value('strategy_score', 15); 
            }
            if (frm.doc.relationship_score > 20) { 
                frappe.msgprint('Relationship cannot exceed 20 points'); 
                frm.set_value('relationship_score', 20); 
            }
             if (frm.doc.incumbent_score > 20) { 
                frappe.msgprint('Incumbent cannot exceed 20 points'); 
                frm.set_value('incumbent_score', 20); 
            } if (frm.doc.competitors_score > 20) { 
                frappe.msgprint('Competitors cannot exceed 20 points'); 
                frm.set_value('competitors_score', 20); 
            } if (frm.doc.hook_score > 20) { 
                frappe.msgprint('Hook cannot exceed 20 points'); 
                frm.set_value('hook_score', 20); 
            } if (frm.doc.financial_score > 20) { 
                frappe.msgprint('Financial cannot exceed 20 points'); 
                frm.set_value('financial_score', 20); 
            }
             if (frm.doc.operational_score > 20) { 
                frappe.msgprint('Operational cannot exceed 20 points'); 
                frm.set_value('operational_score', 20); 
            }
             if (frm.doc.risk_score > 20) { 
                frappe.msgprint('Risk cannot exceed 20 points'); 
                frm.set_value('risk_score', 20); 
            }

            let total = (frm.doc.strategy_score || 0) + 
                        (frm.doc.relationship_score || 0) + 
                        (frm.doc.incumbent_score || 0) + 
                        (frm.doc.competitors_score || 0) + 
                        (frm.doc.hook_score || 0) + 
                        (frm.doc.financial_score || 0) + 
                        (frm.doc.operational_score || 0) + 
                        (frm.doc.risk_score || 0);
            
            frm.set_value('total_score', total);
            
            if (total >= 80) {
                frm.set_value('decision', 'GO');
            } else if (total >= 60) {
                frm.set_value('decision', 'CONDITIONAL');
            } else {
                frm.set_value('decision', 'NO GO');
            }
        };
    },
    
    strategy_score: function(frm) { frm.calculate_score(); },
    relationship_score: function(frm) { frm.calculate_score(); },
    incumbent_score: function(frm) { frm.calculate_score(); },
    competitors_score: function(frm) { frm.calculate_score(); },
    hook_score: function(frm) { frm.calculate_score(); },
    financial_score: function(frm) { frm.calculate_score(); },
    operational_score: function(frm) { frm.calculate_score(); },
    risk_score: function(frm) { frm.calculate_score(); },
    
    refresh: function(frm) {
        // Show 'Create Bid Record' button ONLY if the matrix is Submitted (1) AND scores a 'GO'
        if (frm.doc.docstatus === 1 && frm.doc.decision === 'GO') {
            frm.add_custom_button(__('Create Bid Record'), function() {
                frappe.call({
                    method: 'warroom_app.api.create_bid_from_opportunity', 
                    args: { opportunity_id: frm.doc.opportunity },
                    callback: function(r) {
                        if (r.message && r.message.status === 'success') {
                            frappe.msgprint('Bid Record Created Successfully!');
                            frappe.set_route('Form', 'Bid Record', r.message.new_bid_id);
                        } else {
                            frappe.msgprint({ title: __('Notice'), indicator: 'orange', message: r.message.message });
                        }
                    }
                });
            }).addClass('btn-primary');
        }
    }
});