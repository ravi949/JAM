/**
* @NApiVersion 2.x
* @NScriptType scheduledscript
* 
*/

define(
	[
		'N/https',
		'N/url',
		'N/search',
		'N/runtime',
		'N/email',
      	'N/task'
	], 
	function(https, url,search,runtime,email,task) {
		function scheduled(body){
			try{
				const DEF_SRCHID = '15837';
				var prdFeedSrchId = runtime.getCurrentScript().getParameter({name: 'custscript_mb_prod_feed_srch_id'});//'13306' //Magento Product Feed V2 (Incremental);
				// '13245'; full feed - Magento Product Feed V2
				if(prdFeedSrchId==''|| prdFeedSrchId==null){
					prdFeedSrchId = DEF_SRCHID;
				};
				log.debug('srchId',prdFeedSrchId);
				
				var prdFeedSrch = search.load({
					id: prdFeedSrchId
				});

				var start = runtime.getCurrentScript().getParameter({name:'custscript_mb_prod_feed_start_row'});

				if (start=='' || start ==null){
					start = 0;
				} else {
					start = parseInt(start);
				}

				log.audit('start',start);
				var end = parseInt(start)+999;
				log.audit('end',end);
				var arrMag_prd_Srch = searchGetResultObjects(prdFeedSrch,start,end); //searchGetResultObjects(mag_prd_Srch,null,null);
				log.audit('arrMag_prd_Srch.length',arrMag_prd_Srch.length);
				if(arrMag_prd_Srch.length>0){
							
					var flowUrl = 'https://prod-79.westus.logic.azure.com:443/workflows/813d74322b6d469ab7dc40702e16f5ba/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=lKVMDVhm6h9q_346-cJtbVr3GisiwV-mbKLhGTSHssM';
					
					var _clientResponse = https.post({
						method:https.Method.POST,
						url : flowUrl,
						body : JSON.stringify({'data':arrMag_prd_Srch})
					});	
				
					log.audit('client response',JSON.stringify(_clientResponse.body));

					var params = {
						'custscript_mb_prod_feed_start_row' : end+1,
						'custscript_mb_prod_feed_srch_id' : prdFeedSrchId
					};

					var scriptId = '1651';

					var task = scheduleScript(scriptId,params);

					log.debug('taskId',task);
				};
				/*email.send({
					author: '1423',
					recipients : ['pramod@mibar.net'],
					subject : 'Response in MB_Scheduled_Mag_PrdFeed_export',
					body : 'Please see the attached response: \n'+JSON.stringify(_clientResponse.body),
				});*/
				
			} catch(err){
				log.error('Error in datain',JSON.stringify(err));
				email.send({
					author: '1423',
					recipients : ['pramod@mibar.net'],
					subject : 'Error in searchGetResultObjects - MB_Scheduled_Mag_PrdFeed_export',
					body : 'Please see the attached error: \n'+JSON.stringify(err),
				});
			}
					
		};
		
		
		function searchGetAllResult(option){
            var result = [];
            if(option.isLimitedResult == true){
                var rs = option.run();
                result = rs.getRange(0,1000);
                
                return result;
            }
            
            var rp = option.runPaged();
            rp.pageRanges.forEach(function(pageRange){
                var myPage = rp.fetch({index: pageRange.index});
                result = result.concat(myPage.data);
            });
            
            return result;
        };

		function scheduleScript(script,params){
			try{
				var scriptTask = task.create({
					taskType : task.TaskType.SCHEDULED_SCRIPT
				});
				scriptTask.scriptId = script;
				scriptTask.params = params;
				var taskID = scriptTask.submit();
				log.debug('taskID for script: '+script,taskID);
				return taskID;
			}catch(err){
				log.error('err in scheduleScript',JSON.stringify(err));				//errorHandler(err,'scheduleScript','mb_scheduled_generate_mag_prices',null,null);
				return null;
			}
		}
        
        function searchGetResultObjects(_search,_start,_end){
        	try{
	        	var results;
	        	if (_start!=null && _end!=null){
	            	results = _search.run()//.getRange({
            		results = results.getRange({
	            		start : _start,
	            		end : _end
            		})

	            	//});
	        	} else {
	        		results = searchGetAllResult(_search);
	        	};
	        	log.debug('results',JSON.stringify(results));
	        	
	        	var columns = _search.columns;
	        	log.debug('columns',JSON.stringify(columns));
	
	        	var arrResults = new Array();
	        	
	        	log.debug('results.length',results.length);
	        	
	        	for (var k=0;k<results.length;k++){
	        		
					var tempObj = new Object();				
	        		var result = results[k];
	        		
					for (i=0;i<columns.length;i++){
						if(k==0){
							log.debug('column '+i,JSON.stringify(columns[i]));
							log.debug('column '+i+' value', result.getValue(columns[i]));
						};
						
						if (columns[i].hasOwnProperty('join')==false){
							columns[i].join=null;
						};
						if (columns[i].hasOwnProperty('summary')==false){
							columns[i].summary = null;
						}
						
						var propName = columns[i].label.replace(/ /g,"_");
						
						tempObj[propName] = result.getValue(columns[i]);
					};
					
//					tempArray.push(tempObj);
	        		arrResults.push(tempObj);
	        	};
	        	return arrResults;
        	} catch(err){
        		log.error('err in searchGetResultObjects',JSON.stringify(err));
				email.send({
					author: '1423',
					recipients : ['Pramod@mibar.net'],
					subject : 'Error in searchGetResultObjects - MB_Scheduled_Item',
					body : 'Please see the attached error in the "dataIn" function: \n'+JSON.stringify(err),
				});
				return [];
        	}
        }
        
        function createGuid(){
        	return (s4() + s4() + "-" + s4() + "-4" + s4().substr(0,3) + "-" + s4() + "-" + s4() + s4() + s4()).toLowerCase();
;
        }
        
        function s4() {
            return (((1+Math.random())*0x10000)|0).toString(16).substring(1); 
        }
        
        function base64(stringInput){
            var base64String = encode.convert({
                string: stringInput,
                inputEncoding: encode.Encoding.UTF_8,
                outputEncoding: encode.Encoding.BASE_64
            });
            return base64String;
        }
        
    return {
    	execute : scheduled
    }
});