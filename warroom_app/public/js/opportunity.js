frappe.ui.form.on('Opportunity', {
    refresh: function(frm) {
        if (!frm.is_new() && frm.doc.status !== 'Lost') {
            setTimeout(() => {
                frm.add_custom_button(__('Bid / No-Bid Matrix'), function() {
                    frappe.new_doc('Bid Assessment', {
                        opportunity: frm.doc.name
                    });
                }, __('Create')).addClass('btn-primary');
            }, 500);
        }
    }
});