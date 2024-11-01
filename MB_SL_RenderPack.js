/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

const EMAIL_FROM_DEFAULT = -5;
//const PACKING_SLIP_FOLDER = 463553              // Customer Documents 
const PACKING_SLIP_FOLDER = 432              // Customer Documents 
define(
		[
		  'N/email',
		  'N/render',          
		  'N/runtime',
		  './lib/MBHelpers.js'
        ],
        (email, render, runtime, mbhelp) => {	            
				
			/**
			 * Definition of the Scheduled script trigger point.
			 * 
			 * @param {Object}
			 *            scriptContext
			 * @param {string}
			 *            scriptContext.type - The context in which the script
			 *            is executed. It is one of the values from the
			 *            scriptContext.InvocationType enum.
			 * @Since 2015.2
			 */

			const onRequest = (scriptContext) => {
                try{
                    var mbDocRequestStr = scriptContext.request.parameters.custparam_mb_docRequest;
                    if(mbDocRequestStr) var mbDocRequestObj = mbhelp.isEmpty(mbDocRequestStr) ? {} : JSON.parse(mbDocRequestStr);                
                    log.debug("mbDocRequestObj",mbDocRequestObj);

                    //TODO: Qualify request and fail as necessary. 
                    var packingSlipData  = packingSlip(mbDocRequestObj);
                    if(packingSlipData.success){
                        // Destination = PDF 
                        var documentFile = packingSlipData.documentFile; 
                        documentFile.name = "PackingSlip_" + mbDocRequestObj.internalId + 
                            (mbDocRequestObj.printMode == render.PrintMode.PDF ? '.pdf' : 
                            mbDocRequestObj.printMode == render.PrintMode.HTML ? '.html' : '.txt');

                        documentFile.folder = PACKING_SLIP_FOLDER; // ID of folder where file created
                        documentFile.isOnline = true; 
                        packingSlipData.documentFileId = documentFile.save();
                        
                        scriptContext.response.addHeader({name: 'Content-Type',value: 'application/json'});
                        scriptContext.response.write(packingSlipData);   
                    }
                }catch(err){
                    log.error("Error - packing slip render",err);
                    scriptContext.response.addHeader({name: 'Content-Type',value: 'application/html'});                    
                    scriptContext.response.write(err);   
                }
			}

            const packingSlip = (mbDocRequestObj) =>{
                const packingSlipData = {};                 
				try{			
                    packingSlipData.success = true;       
                    const options = {entityId: mbDocRequestObj.internalId, printMode: mbDocRequestObj.printMode,inCustLocale: true};
                    if(mbDocRequestObj.hasOwnProperty("formId")) options.formId = mbDocRequestObj.formId; 
                    log.debug("options",options);
                    packingSlipData.documentFile = render.packingSlip(options);
				}
				catch(err){
					log.error("error",err);
                    packingSlipData.success = false;                     
                    packingSlipData.response = err.message;
				}
                return packingSlipData;
            }

		    const sendNotification = (respText) => {
		        var author = EMAIL_FROM_DEFAULT;
				var userId = runtime.getCurrentScript().getParameter({name:'custscript_mb_user'});

		        var recipients = userId;
		        var subject = "GateKeeper SO's released ";
		        var body = respText;
                if(userId) {
                    email.send({
                        author: author,
                        recipients: recipients,
                        subject: subject,
                        cc : ['netsuite@mibar.net'],
                        body: body
                    });
                }else{
                    log.error("No userId to send mail to");
                }                
		    }
 		    
			return {onRequest : onRequest};
		});