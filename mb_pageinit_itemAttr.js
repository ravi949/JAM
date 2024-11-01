/**
*@NApiVersion 2.0
*@NScriptName
* @NScriptType ClientScript
*/
define(['N/record', 'N/ui/dialog', 'N/log', 'N/currentRecord'],
    function (record, dialog, log, currentRecord) {
        function pageInit_test(context) {

            var field = currentRecord.getField({
                fieldId: 'CUSTRECORD_MB_IA_ITEM'
            });
            field.isDisabled = true;
        }

        return {
            pageInit: pageInit_test

        };
    });