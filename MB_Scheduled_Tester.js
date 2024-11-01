/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */

define(
		[
            'N/https',
            'N/email',    
            'N/file',        
            'N/record', 
            'N/runtime', 
            'N/search',
            'N/url'         
                ],
		function(https,email,file,record, runtime, search, url ){
					
						
			/**
			 * Definition of the Scheduled script trigger point.
			 * 
			 * @param {Object}
			 *            scriptContext
			 * @param {string}
			 *            scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
			 * @Since 2015.2
			 */

			function execute(scriptContext) {
				try{
                    findFiles(); 
				}
				catch(err){
					throw err;
				}
			}

            function findFiles(){
                var searchId ='customsearch_mb_uploadedorders';
                var searchObj = search.load({id : searchId});
                var searchResults = searchObj.run();                    // Execute Search.
                if (searchResults) {
                    var srchIdx = 0;
                    do {
                        var resultSlc = searchResults.getRange({
                            start : srchIdx,
                            end : srchIdx + 1000
                        });        // Retrieve results in 1000-row slices.
                        for (var i in resultSlc) {                                // Step through the result rows.
                            var folderId = resultSlc[i].id;                // Get Result record internal Id
                            var transactionType = resultSlc[i].recordType;       // Get Result record type
                            var fileId   = resultSlc[i].getValue({name: "internalid",join: "file"});
                            var fileName = resultSlc[i].getValue({name: "name",join: "file"});
                            log.debug(transactionType + folderId + " file = "+fileId + "   "+fileName); 
                            file.delete({id: fileId});
                            srchIdx++;
                        }
                    } while (resultSlc.length >= 1000);
                }
            
            }		
                        
			return {
				execute : execute
			};

		});