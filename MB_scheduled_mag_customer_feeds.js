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
	], 
	function(https, url,search,runtime,email) {
		function scheduled(body){
			try{
				var feeds = [
					{
						feedname: 'customers_f1',
						searchId : '13289'//'13967'//'12022' // CUST Magento Outbound Company Export (F1C)
					},
					{
						feedname:'customers_f2',
						searchId : '13290'//'14167'//'12134'
					},
					{
						feedname : 'customers_f3',
						searchId : '13291'//'14067'//'12141'
					},
					{
						feedname : 'customers_f4',
						searchId : '13292'//'14267'//'12034' // CUST Magento Outbound Customer Export (F2C)
					}
					
					]
				//var prd_feed_SearchId = '11799';
				
				/*var mag_prd_Srch = search.load({
					id: prd_feed_SearchId
				});*/
				for (int=0;int<feeds.length;int++){
                  	var feedSrch = search.load({id: feeds[int].searchId}) 
					var feedData = searchGetResultObjects(feedSrch,null,null); //searchGetResultObjects(mag_prd_Srch,null,null);
									
					var flowUrl = 'https://prod-67.westus.logic.azure.com:443/workflows/ecf3d966f17248d092330cc5ae9109b3/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=fOFS1I0Yp646378S6pH8myuPR6_DBzKT9JzK2bEBTho';
						//'https://prod-79.westus.logic.azure.com:443/workflows/813d74322b6d469ab7dc40702e16f5ba/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=lKVMDVhm6h9q_346-cJtbVr3GisiwV-mbKLhGTSHssM';
					
					var _clientResponse = https.post({
						method:https.Method.POST,
						url : flowUrl,
						body : JSON.stringify({'data':feedData,'feedName' : feeds[int].feedname})
					});	
					
					log.audit('client response',JSON.stringify(_clientResponse.body));
				}
				
					
					
					/*email.send({
						author: '1423',
						recipients : ['lucas@mibar.net'],
						subject : 'Response in MB_scheduled',
						body : 'Please see the attached response: \n'+JSON.stringify(_clientResponse.body),
					});*/
				
			} catch(err){
				log.error('Error in datain',JSON.stringify(err));
				/*email.send({
					author: '1423',
					recipients : ['lucas@mibar.net'],
					subject : 'Error in searchGetResultObjects - MB_Scheduled_Mag_PrdFeed_export',
					body : 'Please see the attached error: \n'+JSON.stringify(err),
				});*/
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
					recipients : ['lucas@mibar.net'],
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