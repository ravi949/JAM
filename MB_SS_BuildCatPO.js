/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */

define(
	[
		'N/record',
		'N/runtime',
		'N/search',		
		'./lib/MBCustomTranLinePO.js'
	],
	(record, runtime, search, mbcustomTran) => {
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

		const execute = (scriptContext) => {
			const transactionInfo = JSON.parse(runtime.getCurrentScript().getParameter({ name: 'custscript_mb_transactioninfo' }));
			log.debug("transactionInfo/ type ", transactionInfo.transactionId + " /  " + transactionInfo.transactionType+ transactionInfo.POLines);
			const POLines = JSON.parse(transactionInfo.POLines); 
			const updateData = buildCAT(transactionInfo,POLines);
		}

		/**
		 *  Build Custom Accrual Trans for this transaction
		 * @param {object} transactionInfo 
		 * @param {Array(string)} POLines passed to the remove logic so ALL CTs can be deleted 
		 */
		const buildCAT = (transactionInfo,POLines) => {
			try {

				if (transactionInfo.transactionType === "CREATE" ||
					transactionInfo.transactionType === "EDIT" ||
					transactionInfo.transactionType === "XEDIT") {
				
					let transactionRcd = record.load({ type: record.Type.PURCHASE_ORDER, isDynamic: false, id: transactionInfo.transactionId });
					removeDeletedCTs(transactionRcd); 
					const scriptContext = { newRecord: transactionRcd, type: transactionInfo.transactionType, oldRecord: transactionRcd };										
					let oResp = mbcustomTran.buildCustomTran(scriptContext);
					if (!oResp.success) throw new Error("error from lib " + oResp.message);
					scriptContext.newRecord.save();

					transactionRcd = record.load({ type: record.Type.PURCHASE_ORDER, isDynamic: false, id: transactionInfo.transactionId });
					scriptContext.newRecord = transactionRcd; 
					oResp = mbcustomTran.updateCustomTran(scriptContext);
				}

				if (transactionInfo.transactionType === "DELETE") {
					removeAllCTs(POLines);
				}

			} catch (err) {
				log.error("Error buildCAT", err);
				//catBuilt.message = "Internal id ~1 error: ".replace("~1",transactionId) + err.message; 
			}

		}
		/**
		 *  
		 * @param {string} transactionId 
		 * @returns all CTs that match this PO 
		 */
		const getCTLines = (transactionId) => {
			// load CTLines 
			const CTLines = new Array();
			if (!transactionId) return CTLines;
			const transactionSearchObj = search.create({
				type: "transaction",
				filters: [
					["type", "anyof", "Custom101"],
					"AND",
					["custbody_mb_ct_createdpo", "anyof", transactionId],
					"AND",
					["mainline", "is", "T"]
				],
				columns: [
					search.createColumn({ name: "custbody_mb_ct_line_key" })
				]
			});
			log.debug("84 transactionSearchObj result count", transactionSearchObj.runPaged().count);
			transactionSearchObj.run().each(function (result) {
				// .run().each has a limit of 4,000 results
				CTLines.push({
					customTransactionId: result.id,
					poLineKey: result.getValue({ name: "custbody_mb_ct_line_key" })
				});

				return true;
			});
			log.debug("94 items array", JSON.stringify(CTLines));			
			return CTLines;
		}
		/**
		 *  delete all CTs for a PO that was removed. 
		 * @param {Array(strings)} CTLines 
		 */
		const removeAllCTs = (CTLines) => {
			try{
				if (CTLines.length>0) {
					CTLines.forEach((customTransactionId) => {
						record.delete({type: "customtransaction_mb_cogs_accrual",id: customTransactionId});

						record.delete({type: "customtransaction_mb_ds_accrual",id: customTransactionId});						
					})
					log.debug("105 delete count", CTLines.length); 					
				}
            }catch (err) {
					log.error("no CT lines found 107 ", + err);
			}
		}
		/**
		 *  Remove the CTs for deleted PO Lines. 
		 * @param {object} transactionRcd 
		 */
		const removeDeletedCTs = (transactionRcd) => {
			try{
				const CTLines = getCTLines(transactionRcd.id); 
				// load POLines 
				let itemSublist = "item"; 
				const lineCount = transactionRcd.getLineCount(itemSublist);
				const POLines = new Array(); 
				for (let i = 0; i < lineCount; i++) {
					let poLineKey = transactionRcd.getSublistValue({ sublistId: itemSublist, fieldId: 'lineuniquekey', line: i });
					POLines.push(poLineKey); 
				}

				if (CTLines.length>0  && POLines.length>0) {
					const deletePOLines = CTLines.filter(function (element, index) {
						return (POLines.indexOf(element.poLineKey)<0)
					});				
					deletePOLines.forEach((item) => {
						record.delete({type: "customtransaction_mb_cogs_accrual",id: item.customTransactionId});
						
						record.delete({type: "customtransaction_mb_ds_accrual",id: customTransactionId});												
					})
					log.debug("delete count", deletePOLines.length); 					
				}else{log.debug("no delete no count");}
            }catch (err) {
					log.error("no PO lines found 97 ", transactionRcd.id + " " + err);
			}
		}
		    
			return { execute: execute };
		});