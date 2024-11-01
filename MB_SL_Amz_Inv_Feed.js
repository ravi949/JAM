/**
 *@NApiVersion 2.0
 *@NScriptType Suitelet
 *
 */

 define(['N/https','N/email','N/search','N/runtime','N/record','N/format','N/xml','N/file','SuiteScripts/Mibar/lib/MB_AMZ_FEED_API.js'],
    function(https,email,search,runtime,record,format,xml,file,feedAPI){

        function onRequest(context){
            try{
                var amzAPI = feedAPI.amzAPI;
                var requestParams = context.request.parameters;
                log.audit('requestParams',JSON.stringify(requestParams));
                if(context.request.parameters._function == 'processFeed'){
                    if(context.request.parameters.feedAcct){
                        context.response.write("Triggering Feed for "+context.request.parameters.feedAcct);
                        var processFeed = feedAPI.processFeed(context.request.parameters.feedAcct,context.request.parameters.feedSrchId);
                        log.audit('processFeed response',JSON.stringify(processFeed));
                    }
                } else if (context.request.parameters._function == 'queryResults'){
                    var feedRecord = context.request.parameters.feedRecord;
                    var company = context.request.parameters.feedAcct;
                    if(feedRecord && company){
                        context.response.write("Triggering Query Results for "+feedRecord);
                        var queryResults = feedAPI.queryResults(company,feedRecord);
                        log.audit('queryResults response',queryResults);
                    }
                }
            }catch(e){
                log.error('amazon feed test error',e);
                context.response.write("Failed starting feed with error: "+e);
            };
        };
                
    return {
        onRequest : onRequest
    };

});