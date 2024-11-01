/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search', 'N/ui/serverWidget'],
    /**
     * @param {record}
     *            record
     */
    function (record, search, serverWidget) {

        const NEW_ONE = "- New -";

        /**
         * Function definition to be triggered before record is loaded.
         * 
         * @param {Object}
         *            scriptContext
         * @param {Record}
         *            scriptContext.newRecord - New record
         * @param {string}
         *            scriptContext.type - Trigger type
         * @param {Form}
         *            scriptContext.form - Current form
         * @Since 2015.2
         */
        function beforeLoad(scriptContext) {
            var form = scriptContext.form;
            var nameField = form.getField("name");
            if (nameField) {
                // nameField.updateDisplayType({
                // displayType : serverWidget.FieldDisplayType.DISABLED
                // });
                if (scriptContext.type == "create") {
                    nameField.defaultValue = NEW_ONE;
                }
            }
        }
        /**
         * Function definition to be triggered before record is loaded.
         * 
         * @param {Object}
         *            scriptContext
         * @param {Record}
         *            scriptContext.newRecord - New record
         * @param {Record}
         *            scriptContext.oldRecord - Old record
         * @param {string}
         *            scriptContext.type - Trigger type
         * @Since 2015.2
         */
        function beforeSubmit(scriptContext) {
        }

        /**
         * Function definition to be triggered before record is loaded.
         * 
         * @param {Object}
         *            scriptContext
         * @param {Record}
         *            scriptContext.newRecord - New record
         * @param {Record}
         *            scriptContext.oldRecord - Old record
         * @param {string}
         *            scriptContext.type - Trigger type
         * @Since 2015.2
         */
        function afterSubmit(scriptContext) {
            log.debug("AS scriptContext.type", scriptContext.type)
            if (scriptContext.type == "xedit" || scriptContext.type == "create" || scriptContext.type == "edit") {
                var tokenRcd = record.load({ type: scriptContext.newRecord.type, id: scriptContext.newRecord.id });
                if (!tokenRcd) return;
                var paymentMethod = tokenRcd.getText({ fieldId: 'custrecord_upybt_pmt' });
                var BTtokenId = tokenRcd.getValue({ fieldId: 'custrecord_upybt_token' });
    
                // set name field

                if (BTtokenId != null) {
                    var newName = (paymentMethod || '') + " - " + BTtokenId;
                    log.debug("new name ",newName);
                    if (newName && newName != NEW_ONE) {
                        tokenRcd.setValue({ fieldId: 'name', value: newName });
                    };
                    tokenRcd.save();                                    
                }

            }

        }
        return { beforeLoad: beforeLoad, beforeSubmit: beforeSubmit, afterSubmit: afterSubmit };
    });
