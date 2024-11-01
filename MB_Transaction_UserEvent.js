/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/search',	
        'N/record',
        'N/runtime',
        'N/email',        
        'N/ui/serverWidget',
        './lib/MBFormatFunctions.js',
        ],

function(search,record ,runtime ,email,serverWidget,mbformat) {
    const AMAZON_FBA_BNC = "3922"; 
    const AMAZON_FBA_JAM = "54"; 

    const AMAZON_MFN_BNC = "3923"; 
    const AMAZON_MFN_JAM = "53"; 
    const WALMART = "62"; 
    const AMAZON_ENTITIES = [AMAZON_FBA_BNC,AMAZON_FBA_JAM,AMAZON_MFN_BNC,AMAZON_MFN_JAM,WALMART];
    
    /**
     *
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {string} scriptContext.type - Trigger type
     * @param {Form} scriptContext.form - Current form
     * @Since 2015.2
     */
    const beforeLoad = (scriptContext) => {
 
		if (runtime.executionContext !== runtime.ContextType.USER_INTERFACE) return;
		
        if (!(scriptContext.type === scriptContext.UserEventType.CREATE || scriptContext.type === scriptContext.UserEventType.EDIT))
        {
        	return;
        }
        
    	var form = scriptContext.form;
		
    	var items = form.getSublist("item");
    	if(items){
    		var field = items.getField("custcol_mb_tax_amount");
    		if(field){
        		field.updateDisplayType({
        		    displayType : serverWidget.FieldDisplayType.DISABLED
        		});
    		}
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
    const beforeSubmit = (scriptContext)  => {

        try{
            const transactionRcd = scriptContext.newRecord;

            log.debug(" scriptContext.type ", scriptContext.type);
                                   
            if ((scriptContext.type == scriptContext.UserEventType.DELETE))
            {
                // Delete invoice fees before deleting invoice record.
                log.debug(" Going to delete ",  'Record is ##  ' + transactionRcd.id);
                deleteInvoiceFees(transactionRcd.id,'1');
                //throw "Invoice deletion not possible now.";
                return; // delete will be completed by NS
            }

            //if ((scriptContext.type !== scriptContext.UserEventType.CREATE)) return; 

            let entity = transactionRcd.getValue({ fieldId: "entity" }); 
            log.debug("bs entity",entity);
            if(AMAZON_ENTITIES.indexOf(entity)<0) return; 

            let amazonTax = mbformat.parseFloatOrZero(transactionRcd.getValue({ fieldId : "custbody_mb_source_inv_tax_amount" }));
            let taxTotal = mbformat.parseFloatOrZero(transactionRcd.getValue({ fieldId : "taxtotal" }));            
            if(amazonTax != taxTotal)
                if(transactionRcd.id){
                    log.debug("befsub sub fields amount",amazonTax);                                                                    
                    transactionRcd.setValue({ fieldId : 'taxamountoverride',  value : amazonTax });                    
                    transactionRcd.setValue({ fieldId : 'taxdetailsoverride' ,value : true });                                        
                }    
            
        } catch(err){
            log.error('ERROR IN BEFORE SUBMIT', JSON.stringify(err));
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
    const afterSubmit = (scriptContext) => {
        log.debug(" AFTS scriptContext.type ", scriptContext.type);            
        const transactionRcd = scriptContext.newRecord;
        let entity = transactionRcd.getValue({ fieldId: "entity" }); 
        log.debug("asub entity",entity);            
        if(AMAZON_ENTITIES.indexOf(entity)<0) return; 

        try{            
            let amazonTax = mbformat.parseFloatOrZero(transactionRcd.getValue({ fieldId: "custbody_mb_source_inv_tax_amount" }));
            let taxTotal = mbformat.parseFloatOrZero(transactionRcd.getValue({ fieldId: "taxtotal" }));            
            if(amazonTax != taxTotal)
                if(transactionRcd.id){
                    log.debug("asub sub fields amount",amazonTax);                            
                    log.debug("type : ", transactionRcd.type);
                    log.debug("id : ", transactionRcd.id);
                    record.submitFields({
                        type : transactionRcd.type,
                        id : transactionRcd.id,
                        values : {'taxamountoverride' : amazonTax,'taxdetailsoverride' : 'T'}
                    });
                }
        } catch(err){
            log.error('After submit error', err.message);
        }

    }    
	
    const deleteInvoiceFees = (invoiceId,actualFees) =>  {
    	// Note : currently both estimated and actual fees are both deleted. To control, use the below boolean & filter.
    	var isActual = actualFees ? "T" : "F";
        //invoiceId = '3355424';
        var feeInternal = 0;
    	var oSearch = new Object();
    
    	oSearch.type = "customrecord_mb_invoice_fees";
    	oSearch.filters = [
    	         	      ["custrecord_mb_invoice_id","is",invoiceId]
    	         	      //,
    	        	      //"AND",
    	        	      //["custrecord_mb_invoice_fee_actual","is",isActual]
    	         	      ];
    	
    	oSearch.columns = [
    	                  search.createColumn({ name: "custrecord_mb_fee_id" }),
                          search.createColumn({name: "internalid"})
    	                   ];

    	var searchResult = search.create(oSearch);
 	    searchResult.run().each(
			function(result) {
				feeInternal  = result.getValue({name: 'internalid'});
				//log.debug(" feeInternal is ", feeInternal);
				if(feeInternal){
					var featureRecord = record.delete({
						   type: 'customrecord_mb_invoice_fees',
						   id: feeInternal,
						   isDynamic: true
					   });
				};
				
				return true;
			});    	
    }
			    
    return {
        beforeLoad: beforeLoad,
        beforeSubmit: beforeSubmit,
        afterSubmit: afterSubmit
    };
    
});