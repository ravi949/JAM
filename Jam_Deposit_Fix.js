/**
* @NApiVersion 2.x
* @NScriptType scheduledscript
* 
*/

define(
	[
		'N/record',
		'N/https',
		'N/url',
		'N/search',
		'N/runtime',
		'N/email',
	], 
	function(record,https, url,search,runtime,email) {
		function scheduled(body){
			try{
				var depositId = 7272113; //7275341
    
				var invoiceId= 7087947;

                                			  
              var invoiceRcd = record.load({
					type: record.Type.INVOICE,
					id: invoiceId,
					"isDynamic": true                  
				});
              
				invoiceRcd.setValue('amountpaid', 0, false);
              invoiceRcd.save();
              
              //exit;
              return;
			log.debug(" did we exit?",'');
              

              var depositRcd = record.load({
					type: record.Type.DEPOSIT,
					id: depositId,
					"isDynamic": true                  
				});

			//
				var custPayment = record.transform({
					 fromType: record.Type.CUSTOMER,
					 fromId: 680, //customerInfo.entity,
					 toType: record.Type.CUSTOMER_PAYMENT,
					 isDynamic: true
				 });
				
				
                var dep_trandate = depositRcd.getValue(('trandate'));
				custPayment.setValue('trandate', dep_trandate, false);
				//log.debug("trandate",custPayment.getValue((mbHelp.gfv('trandate'))));
				custPayment.setValue('aracct', '121', true);
				///custPayment.setValue(mbHelp.sfv('undepfunds',true,true));

                var checkAmount_unapplied = custPayment.getValue(('unapplied'));
                var checkAmount_applied = custPayment.getValue(('applied'));
				log.debug("checkAmount ",checkAmount_applied + '##' +checkAmount_unapplied);
                var checkAmount = custPayment.getValue(('applied'));
				
				// add bank deposit as credit
				var subList = 'credit';
				var found = false;
				var lineCount = custPayment.getLineCount(subList);
				log.debug("lineCount  ",lineCount + '##'+depositId);

                    for (var j = 1; j < lineCount; j++)
                    {
						log.debug("before   ",j + '##'+subList);
                        custPayment.selectLine({sublistId: 'credit',line: j});
						log.debug("after   ",j + '##'+subList);
                        //if(custPayment.getCurrentSublistValue((subList,'doc')) == depositId)
						{
                        	//custPayment.setCurrentSublistValue((subList,'apply',true));
                        	//found = true;
                        }
                    };

			//								
				
			} catch(err){
				log.error('Error in datain',JSON.stringify(err));
				email.send({
					author: '1423',
					recipients : ['pramod@mibar.net'],
					subject : 'Error in Deposit Fix',
					body : 'Please see the attached error: \n'+JSON.stringify(err),
				});
			}
					
		};

    // return Account Info from first other line.
				
        
    return {
    	execute : scheduled
    }
});