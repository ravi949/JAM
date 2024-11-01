/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */
var countryStates={};
var buyerErrors=[];
var buyerErrorJSON={};
var updateActionNewAddress=[];
const WEBSITE_MAP = {
    "fold" : 'Folders.com',
    "env" : 'Envelopes.com',
    "jam" : "Jampaper.com",
	"lab" : "LabelsNStickers.com"
};

// RCM add avalara taxing 
// const TAX_ITEM = 526774;                                            // 334396;
// const TAX_ITEM_CA = 526777                                          //334606;

const TAX_ITEM = 539797;                                            // 334396;
const TAX_ITEM_CA = 539801                                          //334606;


define(['N/record','N/error','N/search'],

function(record, error, search) {
	
	const post = (requestBody) => {

		log.debug("requestBody", requestBody);
		//log.debug("requestBody.buyers", requestBody.buyers);

		var parentCustomer;
		var subCustomerIds=[];
		var subCustomerswithoutAddressNSId=[]
		var subCustomerswithoutAddressMId=[]
		
		//******************************************Create/Update*******************************************//
		if(requestBody.action == "create" || requestBody.action == "update"){
			stateValidation();//to validate the state for the given country
			
			if(requestBody.linkToOrder && requestBody.hasOwnProperty("linkToOrder")){
				var salesorderSearchObj = search.create({
				   type: "salesorder",
				   filters:[ ["type","anyof","SalesOrd"],"AND", ["mainline","is","T"],"AND",["internalid","anyof",requestBody.linkToOrder]],
				   columns:[{name: "internalid", label: "Internal ID"},
					   {name: "formulanumeric",formula: "{mainname.id}",label: "Formula (Numeric)"}]
				});
				var searchResult = salesorderSearchObj.run().getRange({
					start: 0,
					end: 2
				});
				log.debug("searchResult.length",searchResult.length)
				if(searchResult.length==0){
					var responseBody={name: "Error",
													message: "linkToOrder does not match with any of the existing Sales Order Internalids",
												error_severity :'High'}
					throw responseBody
				}
				else{
					try{
						//log.debug("entered else","entered else")
						requestBody.action="update";
						requestBody["netsuite_id"]= searchResult[0].getValue({name: "formulanumeric",formula: "{mainname.id}",label: "Formula (Numeric)"});
						log.debug("requestBody.netsuite_id",requestBody.netsuite_id)
					
						/*record.submitFields({
							type: 'customer',
							id: parentCustomer,
							values: {
								'custentity_ma_magento_order_id': requestBody.linkToOrder
							},
							options: {
						        enableSourcing: false,
						        ignoreMandatoryFields : true
						    }
						});
				record.submitFields({
					type: 'salesorder',
					id: requestBody.linkToOrder,
					values: {
						'entity': parentCustomer
					},
					options: {
				        enableSourcing: false,
				        ignoreMandatoryFields : true
				    }
				});*/
				
				}
				catch(e){
					log.error("error in linkToSo stage",e.message);
					responseBody["status"]=0
					responseBody["Error"]= e.message;
					responseBody["error_severity"] = 'High'
				}
				}	
			}
			
			//****************************************************************************************************//
			parentCustomer= createOrAddCustomer(requestBody,0,-1);
			
			log.debug("returnedData", parentCustomer);
			subCustomerIds.push(parentCustomer)
			if(requestBody.buyers){
				for(var i=0; i<requestBody.buyers.length;i++){
					requestBody.buyers[i]['action']=requestBody.action
					log.debug("requestBody.buyers[i]",requestBody.buyers[i])
					var subCustId = createOrAddCustomer(requestBody.buyers[i], parentCustomer,i);
					buyerErrors.push(buyerErrorJSON)
					
					subCustomerIds.push(subCustId)
					if((!requestBody.buyers[i].addresses || !requestBody.buyers[i].hasOwnProperty("addresses") || requestBody.buyers[i].addresses.length==0) && subCustId!=0){
					subCustomerswithoutAddressNSId.push(subCustId)
					subCustomerswithoutAddressMId.push(requestBody.buyers[i].id)
					}
					
				}
				log.debug("subCustomerIds",subCustomerIds);
			}
			
			if(requestBody.action == "create"){
				log.debug("buyerErrors",buyerErrors)
			try{
				var responseBody={ "status": 1,
					      "magento_company_id": requestBody.id,
						  "netsuite_company_id": parentCustomer };
			
				var customerSearchObj = search.create({type: "customer",
																				filters:[ ["internalid","anyof", subCustomerIds] ],
																				columns:
																					[{name: "isperson", label: "Is Individual"},
																					 {name: "internalid", label: "Internal ID"},
																					 {name: "formulatext",formula: "NVL({parentcustomer.internalid},0)",sort: search.Sort.ASC,label: "Parent" },
																					 {name: "custentity_mb_magento_company_id", label: "MAGENTO COMPANY ID"},
																					 {name: "addressinternalid", join: "Address", label: "Address Internal ID" },
																					 {name: "custrecord_mb_magento_address_id", join: "Address",label: "MAGENTO ADDRESS ID"}]
																			});
				log.debug("customerSearchObj",customerSearchObj)
				var searchResultCount = customerSearchObj.runPaged().count;
			var resultSet = customerSearchObj.run();
			var customerResults = resultSet.getRange({start : 0,end : searchResultCount});
			log.debug("customerResults",customerResults)
			var parentLineCount=0;
			var buyersJson={};
			var subCustomers={}
			for(var j=0;j<searchResultCount;j++){
				log.emergency("formula",customerResults[j].getValue({name: "formulatext",formula: "NVL({parentcustomer.internalid},0)",sort: search.Sort.ASC,label: "Parent"}))
				if(customerResults[j].getValue({name: "formulatext",formula: "NVL({parentcustomer.internalid},1)",sort: search.Sort.ASC,label: "Parent"}) == '0'){
					parentLineCount++ // if parentLineCount==1 then only one address, if >1, there are more that one address for parent/individual
				}
				else{
					subCustomers[customerResults[j].getValue({name: "internalid", label: "Internal ID"})]='F'
				}
			}
			log.emergency("parentLineCount",parentLineCount)
			
			var addressFlag='F';
			var buyersFlag='F'
				log.emergency("searchResultCount",searchResultCount)

			for(var j=0;j<searchResultCount;j++){
				//log.emergency("searchResultCount",searchResultCount)

				if(parentLineCount==1 && j==0 && (customerResults[j].getValue({name: "isperson", label: "Is Individual"}) == false)){ // customer is parent/individual, row is first row and type is company and address count is 1
					log.emergency("company block","companyblock")

					responseBody["netsuite_company_addr_id"]=customerResults[j].getValue({ name: "addressinternalid", join: "Address", label: "Address Internal ID" }) ;
				//responseBody["magento_company_addr_id"]=customerResults[j].getValue({name: "custrecord_mb_magento_address_id", join: "Address",label: "MAGENTO ADDRESS ID"});
				}
				else if(j<parentLineCount){//if address count is greater than 1, add array of address JSONs
					if(addressFlag=='F' && (customerResults[j].getValue({name: "isperson", label: "Is Individual"}) == true)){
					responseBody["addresses"]=[];
					addressFlag='T';
					}
					var addressJSON ={}
					addressJSON["netsuite_company_addr_id"]=customerResults[j].getValue({ name: "addressinternalid", join: "Address", label: "Address Internal ID" })
					addressJSON["magento_company_addr_id"]=customerResults[j].getValue({name: "custrecord_mb_magento_address_id", join: "Address",label: "MAGENTO ADDRESS ID"})
					
					responseBody["addresses"].push(addressJSON);
					log.emergency("responseBody at parent with more than 1 address",responseBody)
				}
				else{//if the results are related to Buyers, add related JSON
					log.emergency("response body - buyers",responseBody)
					if(buyersFlag=='F'){//when loop entered the first buyer, create a key buyers with array value
						responseBody[ "buyers"]=[];
						buyersFlag='T'
					}
					if(subCustomers[customerResults[j].getValue({name: "internalid", label: "Internal ID"})]=='F'){ // JSON creation for Subcustomers with less than or equal to one address
						var newJson={}
						newJson['netsuite_buyer_individual_id']=customerResults[j].getValue({name: "internalid", label: "Internal ID"});
						newJson['magento_buyer_id']=customerResults[j].getValue({name: "custentity_mb_magento_company_id", label: "MAGENTO COMPANY ID"});

						var addressJSON ={}
						addressJSON["netsuite_buyer_individual_addr_id"]=customerResults[j].getValue({ name: "addressinternalid", join: "Address", label: "Address Internal ID" })
						addressJSON["magento_buyer_individual_add_id"]=customerResults[j].getValue({name: "custrecord_mb_magento_address_id", join: "Address",label: "MAGENTO ADDRESS ID"})
						
						newJson['addresses']=[addressJSON];
						
						log.emergency("newJson",newJson)
						responseBody[ "buyers"].push(newJson)
						subCustomers[customerResults[j].getValue({name: "internalid", label: "Internal ID"})]='T';
					}
					else{//if address count for buyers is greater than 1, search for the buyer JSON and push the address value
						var addressJSON ={}
						addressJSON["netsuite_buyer_individual_addr_id"]=customerResults[j].getValue({ name: "addressinternalid", join: "Address", label: "Address Internal ID" })
						addressJSON["magento_buyer_individual_add_id"]=customerResults[j].getValue({name: "custrecord_mb_magento_address_id", join: "Address",label: "MAGENTO ADDRESS ID"})
						var buyers = responseBody["buyers"]
						for(var i=0;i<buyers.length;i++){
						  if(customerResults[j].getValue({name: "internalid", label: "Internal ID"})==buyers[i]["netsuite_buyer_individual_id"]){
						    buyers[i]['addresses'].push(addressJSON) }
						}
					}
				}
			}
			log.emergency("subCustomerswithoutAddressNSId.length",subCustomerswithoutAddressNSId.length)
			
			if(subCustomerswithoutAddressNSId.length!=0){
				if(buyersFlag=='F'){//when loop entered the first buyer, create a key buyers with array value
					responseBody[ "buyers"]=[];
					buyersFlag='T'
				}
				var buyerWithoutAddressJSON={}
				for(var i=0;i<subCustomerswithoutAddressNSId.length;i++){
				buyerWithoutAddressJSON={
					"netsuite_buyer_individual_id": subCustomerswithoutAddressNSId[i] ,
		            "magento_buyer_id": subCustomerswithoutAddressMId[i]
				}
				responseBody["buyers"].push(buyerWithoutAddressJSON)
				}
			}
			log.emergency("subCustomerIds.indexOf(0)",subCustomerIds.indexOf(0));
			if(subCustomerIds.indexOf(0)!=-1){//adding buyers with errors to the Output response
				if(buyersFlag=='F'){//when loop entered the first buyer, create a key buyers with array value
					responseBody[ "buyers"]=[];
					buyersFlag='T'
				}
				responseBody["status"]=0
				for(var i = 1; i < subCustomerIds.length; i++) {
					if(subCustomerIds[i]==0){
						{
							log.debug("requestBody.buyers[i-1].id",requestBody.buyers[i-1].id)
							var buyerJSON={ "magento_buyer_id": requestBody.buyers[i-1].id,
														"error": buyerErrors[i-1][i-1][0]}
							log.debug("buyerJSON",buyerJSON);
							responseBody["buyers"].push(buyerJSON)
						}
					}
				}
			}
			
		
			}
			
			catch(e){
				log.error("error in Create OUT JSON",e);
					e={"name":"Error",
				            "message":e.message,
						"error_severity" : 'Medium'}
					throw e
				}

			}
			else{//**************************************************************Update*******************************************//
				var responseBody= {
					"magento_company_id ": requestBody.id,
					"netsuite_company_id": parentCustomer,
					"Status": 1 
				}
				if(updateActionNewAddress.length!=0){
					var addressArray =0
					var count=0;
					var customerSearchObj = search.create({
																		type: "customer",
																		filters:[ ["internalid","anyof",requestBody.netsuite_id] ],
																		columns: [{name: "internalid", label: "Internal ID"},
																						{name: "isperson", label: "Is Individual"},
																						{name: "addressinternalid",join: "Address",label: "Address Internal ID"},
																						{name: "custrecord_mb_magento_address_id", join: "Address", label: "Magento Address ID"}]
																});
					
					customerSearchObj.run().each(function(result){
						if((result.getValue({name: "isperson", label: "Is Individual"}))== false){
							responseBody["netsuite_company_addr_id"]=result.getValue({ name: "addressinternalid", join: "Address", label: "Address Internal ID" }) ;
							return false;
							}
						var magentoAddressId = result.getValue({ name: "custrecord_mb_magento_address_id", join: "Address", label: "Magento Address ID"});
						if(updateActionNewAddress.indexOf(magentoAddressId)!= -1){
							if(addressArray == 0){
							responseBody['addresses']=[];
							addressArray=1
							}
							count+=1
						var addressJson = {
														"netsuite_buyer_individual_addr_id": result.getValue({ name: "addressinternalid", join: "Address", label: "Address Internal ID" }) ,
														"magento_buyer_individual_add_id": magentoAddressId
													  }
							responseBody['addresses'].push(addressJson)
						}
						if(count==updateActionNewAddress.length){return false;}
					   return true;
					});
				}
			}
		}
		
		//******************************************Remove*******************************************//

		else if(requestBody.action == "remove"){
			try{
			if(!requestBody.netsuite_id || !requestBody.hasOwnProperty("netsuite_id") || !requestBody.id || !requestBody.hasOwnProperty("id")){
				var nsIdMissing = {
						name: "Error",
						message: "netsuite_id or id is missing for the remove action"
				}
				throw nsIdMissing;
			}
			var customerSearchObj = search.create({ 
					type: "customer", 
					filters: [ ["internalid","is",requestBody.netsuite_id],  "AND",  ["custentity_mb_magento_company_id","is",requestBody.id] ], 
					columns: [{name: "internalid", label: "Internal ID"}] });
				
				var searchResult = customerSearchObj.run().getRange({
					start: 0,
					end: 2
				});
				if(searchResult.length==0){
					var nsIdMismatch = {
							name: "Error",
							message: "Netsuite Internal Id (netsuite_id) and Magento Id (id) does not match with existing customer records"
					}
					throw nsIdMismatch;
				}
			
				var customerSearchObj = search.create({
				   type: "customer",
				   filters:[[["parentcustomer.internalid","anyof",requestBody.netsuite_id],"OR",["internalid","anyof",requestBody.netsuite_id]], 
					      "AND",["isinactive","is","F"]],
				   columns:[{name: "internalid", label: "Internal ID"}]});
				
				customerSearchObj.run().each(function(result){ // .run().each has a limit of 4,000 results
					record.submitFields({
						type: 'customer',
						id: result.getValue({name: 'internalid'}),
						values: {
							'isinactive': 'T'
						},
						options: {
					        enableSourcing: false,
					        ignoreMandatoryFields : true
					    }
					})
				   return true;
				});
				
			}
			catch(e){
				log.error("error in Submitting the Customer(s) - remove",e);
					e={"name":"Error",
				            "message":e.message,
						"erro_severity": 'Medium'}
					throw e
				}

			var responseBody= {
					"magento_company_id": requestBody.id,
					"netsuite_company_id": requestBody.netsuite_id,
					"Status": 1
				}
		}
		
		//******************************************Link/Unlink*******************************************//

		else if(requestBody.action=="link" || requestBody.action=="unlink"){
			log.debug("link/unlink","link/unlink")
			if(!requestBody.netsuite_customer_id || !requestBody.hasOwnProperty("netsuite_customer_id") || !requestBody.customer_id || !requestBody.hasOwnProperty("customer_id")){
				var IdMissing = {
						name: "Error",
						message: "netsuite_customer_id/customer_id is missing for the link/unlink action"
				}
				throw IdMissing;
				}
			if((requestBody.action=="link") && (!requestBody.company_id || !requestBody.hasOwnProperty("company_id") || !requestBody.netsuite_company_id || !requestBody.hasOwnProperty("netsuite_company_id"))){
				var IdMissing = {
						name: "Error",
						message: "netsuite_company_id/company_id is missing for the link action"
				}
				throw IdMissing;
			}
			
			var filter =[[["internalid","anyof",requestBody.netsuite_customer_id],"AND",["custentity_mb_magento_company_id","is",requestBody.customer_id]]]
			if(requestBody.action=="link"){ // if action is link, add one more filter to the search
				filter.push("OR")
				filter.push( [["internalid","anyof",requestBody.netsuite_company_id],"AND",["custentity_mb_magento_company_id","is",requestBody.company_id]])
			}
			var customerSearchObj = search.create({ 
				type: "customer", 
				filters: filter, 
				columns: [{name: "internalid", label: "Internal ID"}] });
			
			var searchResult = customerSearchObj.run().getRange({
				start: 0,
				end: 2
			});
			log.emergency("searchResult.length",searchResult.length);
			if(searchResult.length==0){
				var idMismatch = {
						name: "Error"}
				if(requestBody.action=="unlink")
					idMismatch['message']= "netsuite_customer_id and customer_id does not match for the existing customers"
				else					
					idMismatch['message']= "both netsuite_customer_id, customer_id and netsuite_company_id, company_id does not match for the existing customers"

				throw idMismatch;
			}
			else if(searchResult.length==1 && requestBody.action=="link"){
				var idMismatch = {
						name: "Error",
						message: "netsuite_customer_id, customer_id or netsuite_company_id, company_id does not match for the existing customers"}
				throw idMismatch;
			}
			var parent=null;
			if(requestBody.action=="link"){parent = requestBody.netsuite_company_id }
			
			try{
				// added options in submit fields as it's asking to enter Primary Subsidiary
			record.submitFields({
				type: 'customer',
				id: requestBody.netsuite_customer_id,
				values: {
					'parent': parent
				},
				options: {
			        enableSourcing: false,
			        ignoreMandatoryFields : true
			    }
			});
			}
			catch(e){
				log.error("error in Submitting the Customer - link/unlink",e);
					e={"name":"Error",
				            "message":e.message,
						'error_severity' : 'Medium'}
					throw e
				}

			var responseBody= {
				"Status": 1
			}
		}
		
		log.emergency("responseBody",responseBody)
		return responseBody;
	}

	
	//********************************** for State validation for the given Country*********************************//
	function stateValidation(){
		try{
		var stateCountrySearch = search.create({
			type: "state",
			filters:[["inactive","is","F"]],
			columns:[{name: "id"},{name: "fullname"},{name:"shortname"},{name: "country",sort: search.Sort.ASC}]
		});
		var stateCountryResults = stateCountrySearch.run().getRange({start : 0,end : 1000});
		log.debug('stateCountryResults',stateCountryResults.length);
		var country = new Array();
		//var state = {};
		for(var i=0;i<stateCountryResults.length;i++){
			var countryText=stateCountryResults[i].getText({name:'country'});
			var countryValue=stateCountryResults[i].getValue({name:'country'});
			if(country.indexOf(countryValue) == -1){countryStates[countryValue]=[];country.push(countryValue);}
			//state[stateCountryResults[i].getValue({name:'fullname'})]				    =	stateCountryResults[i].getValue({name:'shortname'});
			countryStates[countryValue].push(stateCountryResults[i].getValue({name:'fullname'}));
		}
		log.debug('country',country);
		log.debug('countryStates',countryStates);
		}
		catch(e){
			log.error("error in countries-states",e);
				e={"name":"Error",
			            "message":e.message,
					"error_severity" : 'Medium'}
				throw e
			}
	}

	function createOrAddCustomer( customerData,parent,k){
		
		log.debug("customerData",customerData);
		buyerErrorJSON={}
		buyerErrorJSON[k]=[];
		
		//***********************************Customer Key Mapping***************************************//
		var customerKeyMapping=
		{
				"id": "custentity_mb_magento_company_id",
				"name" : "companyname",
				"legal_name" :"custentity_ma_magento_legal_name",
				"firstname" : "firstname",
				"lastname" : "lastname",
				"group": "category",
				"email":"email",
				"status":"custentity_ma_magento_status",
				"tj_exemption_type":"custentity_tj_exempt_customer_type", 
				"is_super_user":"custentity_ma_magento_is_super_user",
				"job_title":"title",
				"linkToOrder":"custentity_ma_magento_order_id",
                "website" : 'custentity_mb_mag_orig_website',
				'custentity_mb_mag_admin_lastname' : 'custentity_mb_mag_admin_lastname',
				'custentity_mb_mag_admin_lastname' : 'custentity_mb_mag_admin_lastname'
		}
		var customerType;
		//log.debug("customerData.hasOwnProperty('type')",customerData.hasOwnProperty("type"))
		if(!customerData.hasOwnProperty("type")){
			customerType='notMentioned'
		}
		else{
			customerType=customerData.type
		}
		
		//**************************************to detect duplicate customers*************************************************//
		if((customerData.action=="create")){ // || (parent!=0 && customerData.action=="update")
			try{
				if(!customerData.id || !customerData.hasOwnProperty("id")){
					var IdMissing = {
							name: "Error",
							message	: "Missing the required details : id for the create action",
							error_severity : 'High'}
					/*if(parent==0 && customerData=='company'){
						IdMissing['message']= "Required field id is missing to create a company"
							}
					else if(parent!=0){
						IdMissing['message']= "Required field id is missing to create a buyer"
						}
					else{
						IdMissing['message']= "Required field id is missing to create a customer"
					}*/
					throw IdMissing;
				}
			var customerSearchObj = search.create({ 
				type: "customer", 
				filters: [ ["custentity_mb_magento_company_id","is",customerData.id] ], 
				columns: [{name: "internalid", label: "Internal ID"} ] });
			
			var searchResult = customerSearchObj.run().getRange({
				start: 0,
				end: 2
			});
			/*var internalID
			log.debug("internalID",internalID)*/
			// log.debug("searchResult",searchResult.length)
			if(searchResult.length>=1){ // && customerData.action == "create" 
				//if(!customerData.hasOwnProperty("buyers") || customerData.buyers.length==0 || !customerData.buyers){
					var duplicateCustomer = {
							name: "Error",
							message: "The id (Magento Id) already exists in Netsuite",
							error_severity: 'Low',
							line : '551'}
					/*if(parent==0){ // add it for customer, company and buyer
						duplicateCustomer['message']= "The customer Id (Magento Id) already exists in Netsuite"
					}
					else{
						duplicateCustomer['message']= "The Buyer Id (Magento Id) already exists in Netsuite"
					}*/
					throw duplicateCustomer; 
				/*}
				else{// if(searchResult.length==1)
					internalID = searchResult[0].getValue({
						name: 'internalid'
					});
					return internalID
				}*/
			}
		 /*else if(parent!=0 && searchResult.length==0){ // if buyer doesn't exists, create new one by changing the action to Create
				customerData["action"]='create'
		 }*/
		/* else if(searchResult.length>1){ // && customerData.action=="create"
			var duplicateCustomers = {name: "Error"}
			if(parent==0){
				duplicateCustomers['message']= "There are more than one Customer with Id (Magento Id) exists in Netsuite"
			}
			else{
				duplicateCustomers['message']= "There are more than one Buyer with Id (Magento Id) exists in Netsuite"
			}
			throw duplicateCustomers; 
		 }*/
		 }
			catch(e){
				log.error("error in customer search",e);
				err={"name":e.name+'-'+e.error_severity,"message":e.message,'error_severity' :e.error_severity}
				 if(k<0){throw err}
				else{
					buyerErrorJSON[k].push(e);
					return 0
				}
			}	
		}
		
		// *******************************Create Customer*****************************************//
		if(customerData.action == "create"){
		try{
			var customerObject = record.create({
				type		 : "customer",
				isDynamic  : true,
			});
			
			customerObject.setValue('subsidiary',18);  //  Hudson NJ
          // below added by MIBAR 9-20-2022
			 var taxItem = '';
            if(customerData.addresses){
                if(customerData.addresses.length>0){
                    var shipAddress = customerData.addresses[0];
                    log.audit('shipAddress',JSON.stringify(shipAddress));
                    var shipToCountry = shipAddress.country;
                       /*if (shipAddress.length>0){
                           shipAddress= shipAddress[0];
                           var shipToCountry = shipAddress.country;
                       } else { 
                           var shipToCountry = 'US'
                       };*/
               
                       if(shipToCountry.indexOf('CA')>=0 || shipToCountry.indexOf('Canada')>=0||shipToCountry.indexOf('canada')>=0){	
                           // taxItem = '334606'; // CA tax item
                           taxItem = TAX_ITEM_CA; 
                       //  subsidiaryId = 18;
                       }else {
                           //taxItem = '334396'; // US tax item
                           taxItem = TAX_ITEM; 
                           //subsidiaryId = 18;
                       };
                    log.audit('customer taxitem',taxItem)
                 } else {
                    // taxItem = '334396'
                    taxItem = TAX_ITEM; 
                 };
            } else {
                // taxItem = '334396'
                taxItem = TAX_ITEM; 
            };
            
               customerObject.setValue('taxitem',taxItem);// TaxJar - HENJ
			log.debug("customerType",customerType)
			if(customerType=='company' || (customerType=='notMentioned' && customerData.hasOwnProperty("name"))){
				customerObject.setValue('isperson' ,"F");
				if(!customerData.name || !customerData.hasOwnProperty("name")){
					var nameMissing = {
							name: "Error",
							message : "Missing the required details: name for the type Company for create action",
							error_severity : 'Medium'}
					/*if(parent==0){
						nameMissing['message']= "The Customer Name field is missing for the Customer of type Company"
					}
					else{
						nameMissing['message']= "The Buyer Name field is missing for the Customer of type Company"
					}*/
					throw nameMissing;
				}
				else{
					customerObject.setValue('companyname'  ,customerData.name);
				}
			}
			else if((customerType=='individual' || customerType=='buyer') || (customerType=='notMentioned' && customerData.hasOwnProperty("firstname") && customerData.hasOwnProperty("lastname"))){
				customerObject.setValue('isperson' ,"T");
				if(!customerData.firstname || !customerData.lastname || !customerData.hasOwnProperty("firstname") || !customerData.hasOwnProperty("lastname")){
					var NamesMissing = {
							name: "Error",
							message : "Missing the required details: firstname/lastname for the type Individual for create action",
							error_severity : 'Medium'}
					/*if(parent==0){ // add  for buyer & Customer
						NamesMissing['message']= "The Customer First Name or(/and) Last Name values are missing for the Customer of type Individual" 
					}
					else{
						NamesMissing['message']= "The Buyer First Name or(/and) Last Name values are missing for the Customer of type Individual"
					}*/
					throw NamesMissing;
				}
				else{
					customerObject.setValue('firstname'  ,customerData.firstname);
					customerObject.setValue('lastname'  ,customerData.lastname);
				}
			}
			else{
				var namemissing={
						name: "Error",
						message: "Missing the required details: name or firstname & lastname to create a customer",
						error_severity : 'Medium'
				}
				throw namemissing
			}
		 }
		catch(e){
			log.error("error in create",e);
			e={"name":"Error","message":e.message,
		"error_severity":'Medium'}
			 if(k<0){throw e}
			 else{
					buyerErrorJSON[k].push(e);
					return 0
				}
		}

		}
		
		// **********************************************Update Customer***************************************************//

		else if(customerData.action == "update"){
			try{
			log.debug("entered update block","update block")
			if(!customerData.linkToOrder || !customerData.hasOwnProperty("linkToOrder")){
			if(!customerData.netsuite_id || !customerData.hasOwnProperty("netsuite_id") || !customerData.id || !customerData.hasOwnProperty("id")){
				var nsIdMissing = {
						name: "Error",
						message: "Missing the required details : netsuite_id or id for the update action",
						error_severity : 'Medium'
				}
				throw nsIdMissing;
			}
			
				var customerSearchObj = search.create({ 
					type: "customer", 
					filters: [ ["internalid","is",customerData.netsuite_id],  "AND",  ["custentity_mb_magento_company_id","is",customerData.id] ], 
					columns: [{name: "internalid", label: "Internal ID"}] });
				
				var searchResult = customerSearchObj.run().getRange({
					start: 0,
					end: 2
				});
				if(searchResult.length==0){
					var nsIdMismatch = {
							name: "Error",
							message: "netsuite_id (Netsuite Internal Id) and id (Magento Id) does not match with the existing customer records",
							error_severity : 'Medium'
					}
					throw nsIdMismatch;
				}
			}
			var customerObject = record.load({
				type			 : "customer",
				id				: customerData.netsuite_id,
				isDynamic  : true
			});
			}
			catch(e){
				log.error("error in update",e);
				e={"name":"Error","message":e.message,'error_severity':'Medium'}
				 if(k<0){throw e}
				 else{
							buyerErrorJSON[k].push(e);
							return 0
						}
			}

		}
  //*************************************************Common Logic for create and update*************************************************//
		try{
		//log.debug("if elseif close",customerObject);
		for (var key in customerKeyMapping)
		{
			//log.debug("testing1 key",key)
			if(customerData.hasOwnProperty(key))
			{
				var fieldid =customerKeyMapping[key];
				var value   = customerData[key];
				if(key == 'is_super_user' || key == 'status'){
					if(value==1){ value = true }
					else{  value = false }
				}
				if(key == 'group' && value){
					var customerCategorySearchObj = search.create({ 
						type: "customercategory", 
						filters:[["isinactive","is","F"], "AND", ["name","is",value]],
						columns:[{name: "internalid", label: "Internal ID"}]
					});
					//log.debug("customerCategorySearchObj",customerCategorySearchObj)
					var customerCategory = customerCategorySearchObj.run().getRange({ start: 0,end: 1 });
					
					if(customerCategory.length!=0){
						value = customerCategory[0].getValue({
							name: 'internalid'
						});
						//log.debug("customerCategory.length",customerCategory.length)
					}
					else{
						var custCategoryNotFound={
								name : "Error",
								message : "group (Customer Category) with name does not exists in Netsuite",
								error_severity : 'Medium'
						}
						log.debug("custCategoryNotFound",custCategoryNotFound)
						throw custCategoryNotFound
					}
				}
				if(key == 'tj_exemption_type' && value){
					//if(value=='non_exempt'){value ='Non-Exempt';}
					log.audit('tax_exemption_type', value);
					var taxableStatus = value =='non_exempt' ? true : false;
					// RCM add avalara taxing 
					//
					// var tj_exempt_typeSearchObj = search.create({
					// 															 type: "customrecord_tj_exempt_customer_type",
					// 															 filters: [ ["custrecord_tj_exempt_customer_type_code","is",value] ],
					// 															 columns: [{name: "internalid", label: "Internal ID"},
					// 																 			{name: "name", sort: search.Sort.ASC, label: "Name"}]
					// 													});
					// var tjExcemptType = tj_exempt_typeSearchObj.run().getRange({ start: 0,end: 1 });
					
					// if(tjExcemptType.length!=0){
					// 	value = tjExcemptType[0].getValue({
					// 		name: 'internalid'
					// 	});
						
					// }
					// else{
					// 	var tjExemptTypeNotFound={
					// 			name : "Error",
					// 			message : "tj_exemption_type (TaxJar Exemption Type) with given Type Code does not exists in Netsuite",
					// 			error_severity : 'Medium'
					// 	}
					// 	log.debug("tjExemptTypeNotFound",tjExemptTypeNotFound)
					// 	throw tjExemptTypeNotFound
					// }
					if (taxableStatus == false){
						customerObject.setValue({
							fieldId : 'taxable',
							value : taxableStatus
						});
						// added cert # logic 

						customerObject.setValue({
							fieldId: 'custentity_ava_exemptcertno',
							value : 'EXEMPT'
						});
					};
						// customerObject.setValue({
						// 	fieldId : 'custentity_tj_exempt_customer',
						// 	value: !taxableStatus
						// });
						
					// }
					continue; 
				}
                if (key == 'website'){
                    value = WEBSITE_MAP[value];
                };
				//log.debug("testing2 value",value)
				
				customerObject.setValue({
					fieldId:fieldid,
					value:value
				});
				//log.debug("testing3",customerObject)
			}    
		} 
		//log.debug("setfields log",customerObject);
		}
		catch(e){
			log.error("error in update/create",e);
			e={"name":"Error","message":e.message,'error_severity' : 'Medium'}
			 if(k<0){throw e}
			 else{
						buyerErrorJSON[k].push(e);
						return 0
					}
		}
    //********************************************For Address Create/Update*********************************************//		
		if(customerType=='company'){
			var customerArray=[customerData];
			log.debug("customerArray",customerArray[0])
			if(customerData.action=='create' && customerData.hasOwnProperty('country') && customerData.country){
				var addAddressReturn = addAddress(customerArray,customerObject,k)
				//log.debug("addAddressReturn",addAddressReturn)
				if(addAddressReturn==0){ return 0}
			}
			else if(customerData.action=='update' && customerData.hasOwnProperty('country') && customerData.country){
				updateAddress(customerArray,customerObject)
			}
		}
		log.debug("customerData.addresses",customerData.addresses)
		if(customerData.addresses && customerData.hasOwnProperty('addresses')){
			if(customerData.action=='create'){
				var addAddressReturn = addAddress(customerData.addresses,customerObject,k)
				/*log.debug("addAddressReturn",addAddressReturn)
				log.debug("typrof addAddressReturn", typeof(addAddressReturn))*/

				if(addAddressReturn==0){ return 0}
			}
			else if(customerData.action=='update'){
				updateAddress(customerData.addresses,customerObject)
			}
		}
		try{//if the customer has parent
		if(parent!=0){
			customerObject.setValue('parent'  ,parent);
		}
		log.debug("customerObject before save",customerObject)
		var customerRecordID     =  customerObject.save();
		log.debug("customerRecordID"  ,customerRecordID)
		return customerRecordID;
		}
		catch(e){
			log.error("error in saving the customer",e);
			e={"name":"Error","message":e.message,'error_severity':'Medium'}
			 if(k<0){throw e}
			 else{
						buyerErrorJSON[k].push(e);
						return 0
					}
		}

	}
	
	// **********************************************Add Address**************************************************//
	function addAddress(addressDetails, customerObject,k){
		try{
		log.debug("addaddress details",addressDetails)
		for(var i=0;i<addressDetails.length;i++){
			customerObject.selectNewLine({
				sublistId: 'addressbook'
			})
			var addressSubRecord = customerObject.getCurrentSublistSubrecord({
				sublistId: 'addressbook',
				fieldId: 'addressbookaddress'
			});
			/*log.debug("addressDetails[i].country",!addressDetails[i].country)
			log.debug("addressDetails[i].hasOwnProperty('country')",addressDetails[i].hasOwnProperty("country"))*/
			if(!addressDetails[i].country || !addressDetails[i].hasOwnProperty("country") ){
				var countryMissing = {
						name: "Error",
						message: " Missing the required details : country to create the address"
				}
				throw countryMissing;
			}
			var addOrUpdateAddressReturn = addOrUpdateAddress(addressDetails[i],customerObject,addressSubRecord,k)
			if(addOrUpdateAddressReturn==0){return 0}
		}
		}
		catch(e){
			log.error("error in addAddress",e);
			e={"name":"Error", "message":e.message,'error_severity' : 'Medium'}
				 if(k<0){throw e}
				 else{
							buyerErrorJSON[k].push(e);
							return 0
						}
			}
	}

	// **********************************************Update Address**************************************************//
	function updateAddress(addressDetails, customerObject){
		try{
		/*log.debug("addressDetails updatefunction",addressDetails)
		log.debug("customerObject updatefunction",customerObject)*/
		
		for(var i=0; i<addressDetails.length;i++){
			var oldAddress='F'
			var lineCount = customerObject.getLineCount({
				sublistId: 'addressbook'
			});
			//log.debug("lineCount",lineCount);
			for(var j=0;j<lineCount;j++){
				customerObject.selectLine({
					sublistId: 'addressbook',
					line: j
				})
				var addressSubRecord = customerObject.getCurrentSublistSubrecord({
					sublistId: 'addressbook',
					fieldId: 'addressbookaddress'
				});
				var addressMagentoId = addressSubRecord.getValue("custrecord_mb_magento_address_id")
				/*log.debug("addressMagentoId",addressMagentoId);
				log.debug("addressDetails[i].id",addressDetails[i].id)*/
				if(addressMagentoId==addressDetails[i].id){
					log.debug("enterd if","entered addressMagentoId")
					addOrUpdateAddress(addressDetails[i],customerObject,addressSubRecord,-2)
					oldAddress='T';
					//log.debug("oldaddress 1",oldAddress)
				}
			}
			//log.debug("oldaddress 2",oldAddress)

			if(oldAddress=='F'){ //if address doen't match, create new address
				log.debug("eneted oldaddress=F","entered oldaddress=F")
				updateActionNewAddress.push(addressDetails[i].id);
				addAddress([addressDetails[i]], customerObject)
				/*var addressNotFound = {
					name: "Error",
					message: " The address Id does not match with any of the Address lines"
				}
			throw addressNotFound;*/
			}
		}
		}
		catch(e){
			log.error("error in updateAddress",e);
				e={"name":"Error",
			            "message":e.message,
					'error_severity': 'Medium'}
				throw e
			}
	}

	//**********************************Common logic for add or update Address fields******************************************//
	function addOrUpdateAddress(addressDetails,customerObject,addressSubRecord,k){
		try{
		var addressKeyMapping = {
			"postcode":"zip",
				"addr1": "addr1",
				"addr2": "addr2",
				"addr3": "addr3",
				"city":"city",
				"telephone":"addrphone",
				"region": "state",
				"id" : "custrecord_mb_magento_address_id"}
		//var countryName
		if(addressDetails.hasOwnProperty('country')){
			if((addressDetails.country).length==2){addressSubRecord.setValue('country', addressDetails.country); }
			else {addressSubRecord.setText('country', addressDetails.country);}
		}
		/*countryName = addressSubRecord.getText('country');
		log.debug("countryName",countryName)*/
		for(var key in addressKeyMapping)
		{
			/*log.debug("addressDetails",addressDetails)
			log.debug("addressDetails.hasOwnProperty(key)",addressDetails.hasOwnProperty(key))*/
			if(addressDetails.hasOwnProperty(key))
			{
				var fieldid =addressKeyMapping[key];
				var value   = addressDetails[key];
				log.debug("Fields and Value",fieldid+"  "+value)
				log.debug("Fields and Value",fieldid+"  "+value.length)
				if(key=="region"){
                  // Updated by MIBAR on 9-22-2022
                    if(value=='Newfoundland and Labrador'){
                       value = 'Newfoundland';
                    };
                  	log.audit('value',value);
					if(countryStates.hasOwnProperty(addressDetails['country'])== true && value){//if the country name key is available in the countryStates JSON, then the state is a dropdown state
						var newState = countryStates[addressDetails['country']]
						if (newState.indexOf(value) == -1)// if state is not found in the countryStates array
							{
							var stateError= {
									name: "Error",
									message: "State is invalid for the provided Country"
									}
							throw stateError
							}
						else{
							log.debug("value",value)
							addressSubRecord.setText('dropdownstate',value);
						}
						}
					else{// if state field is not a dropdown field
						addressSubRecord.setValue({
							fieldId:'state',
							value:value
						});
					}
				}
				// added by MIBAR 9-8-2022;
                 else if(fieldId = 'addrphone'){
                    if (value.length<7){
                        continue
                    } else {
                        addressSubRecord.setValue({
                            fieldId:fieldid,
                            value:value
                        });
                    }
                 }
                 else{
                 addressSubRecord.setValue({
                     fieldId:fieldid,
                     value:value,
					 ignoreFieldChange : true
                 });
				}
				//log.debug("addressSubRecord before committing line",addressSubRecord)
			}
		} 
		
		customerObject.commitLine({
			sublistId: 'addressbook'
		});	
		}
		catch(e){
			log.error("error in addOrUpdateAddress",e);
				e={"name":"Error","message":e.message,'error_severity': 'Low'}
				 if(k<0){throw e}
				else{
							buyerErrorJSON[k].push(e);
							return 0
						}
			}
	}
	return {
		post: post
	}

});