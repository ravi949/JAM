/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope TargetAccount
 */
define(['N/runtime', 'N/record', 'N/email'],
    function(runtime, record, email) {
        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type
         * @param {Form} scriptContext.form - Current form
         * @Since 2015.2
         */
        function beforeLoad(scriptContext) {
            try {

            } catch (ex) {
                log.error(ex.name, ex.message);
            }
        }
        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type
         * @Since 2015.2
         */
        function beforeSubmit(scriptContext) {}
        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type
         * @Since 2015.2
         */
        function afterSubmit(scriptContext) {
            try {
                if(scriptContext.type == "create"){
                    var soRec = scriptContext.newRecord;
                    var lineCount = soRec.getLineCount({
                        sublistId: 'item'
                    });

                    var docNo = soRec.getValue('tranid');

                    if(lineCount == 1){
                        var print= soRec.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcolart_option',
                            line: 0
                        });
                        if(print){
                            email.send({
                                author: 2609521,
                                recipients: [23759,677,38102,2527810,1541128],
                                subject: 'Adder missing in Order',
                                body: 'Hi , Adder is missing in the below order :'+docNo                                
                            });
                        }
                    }
                }
            } catch (ex) {
                log.error(ex.name, ex.message);
            }
        }
        return {
            beforeLoad: beforeLoad,
            beforeSubmit: beforeSubmit,
            afterSubmit: afterSubmit
        };
    });