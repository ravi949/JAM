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
				var inv_feed_SearchId = '11819';
				var scriptId = '1652';
				var mag_inv_Srch = search.load({
					id: inv_feed_SearchId
				});
				var start = runtime.getCurrentScript().getParameter({name:'custscript_mb_inv_search_start'});
                if(start==0 || start==null || start==''){
                  start=0
              } else {
                  start= parseInt(start);
              };
				var end = parseInt(start)+999;
				log.debug('start,end',start.toString()+','+end.toString());

				var arrMag_inv_Srch = searchGetResultObjects(mag_inv_Srch,start,end); //searchGetResultObjects(mag_prd_Srch,null,null);
		
				var flowUrl = 'https://prod-91.westus.logic.azure.com:443/workflows/72069423a40247989a0282e9901fcaba/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=FBkwoHaT1ppQTkeUd1Om_tsugOAokp4EoGJSPWfO7GQ';
              
                if(arrMag_inv_Srch.length>0){
                  var _clientResponse = https.post({
                      method:https.Method.POST,
                      url : flowUrl,
                      body : JSON.stringify({'data':arrMag_inv_Srch})
                  });	
				
				log.audit('client response',JSON.stringify(_clientResponse.body));
				
				email.send({
					author: '1423',
					recipients : ['pramod@mibar.net'],
					subject : 'Response in MB_Scheduled_Mag_InvFeed_export',
					body : 'Please see the attached response: \n'+JSON.stringify(_clientResponse.body),
				});
//                  log.debug('https response',JSON.stringify(response));
	    		log.debug('end+1',end+1);
	    		var params = {
    				'custscript_mb_inv_search_start' : end+1
	    		};
	    		var task = scheduleScript(scriptId,params);
	    		log.debug('task in execute block',task);
                }
                  
				
			} catch(err){
				log.error('Error in datain',JSON.stringify(err));
				email.send({
					author: '1423',
					recipients : ['pramod@mibar.net'],
					subject : 'Error in searchGetResultObjects - MB_Scheduled_Mag_InvFeed_export',
					body : 'Please see the attached error: \n'+JSON.stringify(err),
				});
			}
					
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
      		log.error('err in scheduling script',JSON.stringify(err))	//errorHandler(err,'scheduleScript','mb_scheduled_generate_mag_prices',null,null);
      		return null;
      	}
      }
      
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
					subject : 'Error in searchGetResultObjects - MB_Scheduled_InvFeed_Magento',
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