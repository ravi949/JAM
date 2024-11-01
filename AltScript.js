require(["N/search"],
		    			
function(search){
try{
    createSearches(); 	
}
catch(err){
	console.log(err);
}
function createSearches(){
    // search1(); 
    // search2();
    // search3();
    //s4(search);
//    s5(search);    
vendorPOSearch();
//s7(); 
}
function search1(){
    var salesorderSearchObj = search.create({
        type: "salesorder",
        filters:
        [
           ["type","anyof","SalesOrd"], 
           "AND", 
           ["taxline","is","F"], 
           "AND", 
           ["cogs","is","F"], 
           "AND", 
           ["mainline","is","F"], 
           "AND", 
           ["shipping","is","F"]
        ],
        columns:
        [
           search.createColumn({
              name: "formulanumeric",
              summary: "SUM",
              formula: "1"
           }),
           search.createColumn({
              name: "custbody_mb_import_batch",
              summary: "GROUP"
           })
        ],
        title:'Batch Item Count (CODE LINKED SEARCH)',
        id: 'customsearch_mb_batch_items',
        isPublic: true 

     });
     var searchResultCount = salesorderSearchObj.runPaged().count;
     log.debug("salesorderSearchObj result count",searchResultCount);
     salesorderSearchObj.run().each(function(result){
        // .run().each has a limit of 4,000 results
        return true;
     });

    salesorderSearchObj.save();
}
function search2(){
    var salesorderSearchObj = search.create({
        type: "salesorder",
        filters:
        [
           ["type","anyof","SalesOrd"], 
           "AND", 
           ["mainline","is","T"]
        ],
        columns:
        [
           search.createColumn({
              name: "tranid",
              summary: "COUNT"
           })
        ],
        title:'CSV Import Order count (CODE LINKED SEARCH)',
        id: 'customsearch_mb_import_order_checker',
        isPublic: true 
     });
     var searchResultCount = salesorderSearchObj.runPaged().count;
     log.debug("salesorderSearchObj result count",searchResultCount);
     salesorderSearchObj.run().each(function(result){
        // .run().each has a limit of 4,000 results
        return true;
     });
     salesorderSearchObj.save();     
}
function search3(){
    var salesorderSearchObj = search.create({
        type: "salesorder",
        filters:
        [
           ["type","anyof","SalesOrd"], 
           "AND", 
           ["item","anyof","99965"], 
           "AND", 
           ["taxline","is","F"], 
           "AND", 
           ["cogs","is","F"], 
           "AND", 
           ["mainline","is","F"], 
           "AND", 
           ["shipping","is","F"]
        ],
        columns:
        [
           search.createColumn({
              name: "formulanumeric",
              summary: "SUM",
              formula: "case when 1=1 then 1 else 0 end "
           }),
           search.createColumn({
              name: "item",
              summary: "GROUP"
           }),
           search.createColumn({
              name: "tranid",
              summary: "GROUP"
           })
        ],
        title:'Sales Orders with bad items (CODE LINKED SEARCH)',
        id: 'customsearch_mb_bad_items',
        isPublic: true 

     });
     var searchResultCount = salesorderSearchObj.runPaged().count;
     log.debug("salesorderSearchObj result count",searchResultCount);
     salesorderSearchObj.run().each(function(result){
        // .run().each has a limit of 4,000 results
        return true;
     });
     salesorderSearchObj.save();     
}

function s4(search){
    	
   var inventorybalanceSearchObj = search.create({
      type: "inventorybalance",
      filters:
      [
         ["onhand","greaterthan","0"], 
         "AND", 
         ["location","anyof","12","11","60"], 
         "AND", 
         ["item.inventorylocation","anyof","12","11","60"], 
         "AND", 
         ["item.locationquantityonhand","greaterthan","0"]
      ],
      columns:
      [
         search.createColumn({
            name: "item",
            summary: "GROUP",
            label: "itemName"
         }),
         search.createColumn({
            name: "internalid",
            join: "item",
            summary: "GROUP",
            label: "itemInternalId"
         }),
         search.createColumn({
            name: "salesdescription",
            join: "item",
            summary: "GROUP",
            label: "itemDescription"
         }),
         search.createColumn({
            name: "binnumber",
            join: "binNumber",
            summary: "GROUP",
            label: "binNumber"
         }),
         search.createColumn({
            name: "internalid",
            join: "binNumber",
            summary: "GROUP",
            label: "binInternalId"
         }),
         search.createColumn({
            name: "location",
            summary: "GROUP",
            label: "binLocation"
         }),
         search.createColumn({
            name: "name",
            join: "location",
            summary: "GROUP",
            label: "binLocationName"
         }),
         search.createColumn({
            name: "onhand",
            summary: "MAX",
            label: "binOnHandQty"
         }),
         search.createColumn({
            name: "available",
            summary: "MAX",
            label: "binOnHandAvail"
         }),
         search.createColumn({
            name: "formulanumeric",
            summary: "MAX",
            formula: "case when {item.preferredbin}='T' and case when {item.binnumber}= {binnumber} then 'true' else 'false' end = 'true'  then 1 else 0 end ",
            sort: search.Sort.DESC,
            label: "binIsPreferred"
         })
      ]
   });
   var searchResultCount = inventorybalanceSearchObj.runPaged().count;
   log.debug("inventorybalanceSearchObj result count",searchResultCount);
   // inventorybalanceSearchObj.run().each(function(result){
   //    // .run().each has a limit of 4,000 results
   //    return true;
   // });
   
   
   inventorybalanceSearchObj.id="customsearch1666100442990";
   inventorybalanceSearchObj.title="Inventory for Shipworks V2 - CODE LINKED DO NOT EDIT  COPY  (copy)";
   var newSearchId = inventorybalanceSearchObj.save();
   
}
function s5(search){
    var itemSearchObj = search.create({
        type: "item",
        filters:
        [
           ["inventorylocation","anyof","2"]
        ],
        columns:
        [
           search.createColumn({
              name: "internalid",
              sort: search.Sort.ASC,
              label: "Internal ID"
           }),
           search.createColumn({
              name: "inventorylocation",
              sort: search.Sort.ASC,
              label: "Inventory Location"
           }),
           search.createColumn({name: "locationreorderpoint", label: "Location Reorder Point"}),
           search.createColumn({name: "locationpreferredstocklevel", label: "Location Preferred Stock Level"}),
           search.createColumn({name: "locationquantityavailable", label: "Location Available"}),
           search.createColumn({name: "locationquantitybackordered", label: "Location Back Ordered"}),
           search.createColumn({name: "reordermultiple", label: "Reorder Multiple"}),
           search.createColumn({
              name: "itemid",
              sort: search.Sort.ASC,
              label: "Name"
           })
        ]
     });
     var searchResultCount = itemSearchObj.runPaged().count;
     log.debug("itemSearchObj result count",searchResultCount);
    //  itemSearchObj.run().each(function(result){
    //     // .run().each has a limit of 4,000 results
    //     return true;
    //  });
     
     
     itemSearchObj.id="customsearch_mb_reorder_list";
     itemSearchObj.title="Reorder point Item for Location (CODE LINKED SEARCH) ";
     var newSearchId = itemSearchObj.save();
     
}
function s6(){
    var itemSearchObj = search.create({
        type: "item",
        filters:
        [
        ],
        columns:
        [
           search.createColumn({
              name: "itemid",
              sort: search.Sort.ASC,
              label: "Name"
           }),
           search.createColumn({name: "locationaveragecost", label: "Location Average Cost"}),
           search.createColumn({name: "averagecost", label: "Average Cost"}),
           search.createColumn({name: "locationquantityavailable", label: "Location Available"}),
           search.createColumn({
              name: "averagecost",
              join: "CUSTITEM_MB_INV_ITEM_PARENT",
              label: "Average Cost"
           }),
           search.createColumn({
              name: "formulanumeric",
              formula: "coalesce({CUSTITEM_MB_INV_ITEM_PARENT.averagecost},0) * coalesce({custitem_mb_item_pack_size},0)",
              label: "parent_avgcost"
           }),
           search.createColumn({
              name: "formulanumeric",
              formula: "case when {locationquantityonhand} <=0 then coalesce({locationquantityonhand},0) else coalesce({locationquantityavailable},0) end",
              label: "quantityavailable"
           })
        ]
     });
     var searchResultCount = itemSearchObj.runPaged().count;
     log.debug("itemSearchObj result count",searchResultCount);
     itemSearchObj.run().each(function(result){
        // .run().each has a limit of 4,000 results
        return true;
     });         
     
     itemSearchObj.id="customsearch15401";
     itemSearchObj.title="Inventory Qtys by Location";
     var newSearchId = itemSearchObj.save();
     
}
function s7(){
   var purchaseorderSearchObj = search.create({
      type: "purchaseorder",
      filters:
      [
         ["type","anyof","PurchOrd"], 
         "AND", 
         ["internalidnumber","equalto","11678040"], 
         "AND", 
         ["mainline","is","F"]
      ],
      columns:
      [
         search.createColumn({name: "tranid", label: "Document Number"}),
         search.createColumn({name: "entity", label: "Name"}),
         search.createColumn({name: "amount", label: "Amount"}),
         search.createColumn({name: "trandate", label: "Date"}),
         search.createColumn({name: "appliedtotransaction", label: "Applied To Transaction"}),
         search.createColumn({name: "lineuniquekey", label: "Line Unique Key"}),
         search.createColumn({name: "line", label: "Line ID"}),
         search.createColumn({name: "item", label: "Item"}),
         search.createColumn({
            name: "lineuniquekey",
            join: "appliedToTransaction",
            label: "Line Unique Key"
         })
      ]
   });
   var searchResultCount = purchaseorderSearchObj.runPaged().count;
   log.debug("purchaseorderSearchObj result count",searchResultCount);
   // purchaseorderSearchObj.run().each(function(result){
   //    // .run().each has a limit of 4,000 results
   //    return true;
   // });


   purchaseorderSearchObj.id="customsearch_mb_1676993179496";
   purchaseorderSearchObj.title="po ds";
   var newSearchId = purchaseorderSearchObj.save();
}

function s8(){
      var salesorderSearchObj = search.create({
      type: "salesorder",
      filters:
      [
         ["type","anyof","SalesOrd"], 
         "AND", 
         ["internalidnumber","equalto","11677940"], 
         "AND", 
         ["mainline","is","F"]
      ],
      columns:
      [
         search.createColumn({name: "tranid", label: "Document Number"}),
         search.createColumn({name: "entity", label: "Name"}),
         search.createColumn({name: "amount", label: "Amount"}),
         search.createColumn({name: "trandate", label: "Date"}),
         search.createColumn({name: "appliedtotransaction", label: "Applied To Transaction"}),
         search.createColumn({name: "lineuniquekey", label: "Line Unique Key"}),
         search.createColumn({name: "line", label: "Line ID"}),
         search.createColumn({name: "item", label: "Item"}),
         search.createColumn({
            name: "lineuniquekey",
            join: "appliedToTransaction",
            label: "Line Unique Key"
         })
      ]
      });
      var searchResultCount = salesorderSearchObj.runPaged().count;
      log.debug("salesorderSearchObj result count",searchResultCount);

      // salesorderSearchObj.run().each(function(result){
      // // .run().each has a limit of 4,000 results
      // return true;
      // });


      salesorderSearchObj.id="customsearch_mb_1676993226823";
      salesorderSearchObj.title="so ds ";
      var newSearchId = salesorderSearchObj.save();

}
function vendorPOSearch(){
   var vendorbillSearchObj = search.create({
      type: "vendorbill",
      filters:
      [
         ["type","anyof","VendBill"], 
         "AND", 
         ["numbertext","haskeywords","1011211_D09"], 
         "AND", 
         ["mainline","is","F"]
      ],
      columns:
      [
         search.createColumn({name: "item", label: "Item"}),
         search.createColumn({
            name: "tranid",
            join: "appliedToTransaction",
            label: "Document Number"
         }),
         search.createColumn({
            name: "item",
            join: "appliedToTransaction",
            label: "Item"
         }),
         search.createColumn({
            name: "amount",
            join: "appliedToTransaction",
            label: "Amount"
         }),
         search.createColumn({
            name: "custcol_mb_ct_link",
            join: "appliedToTransaction",
            label: "Accrual Transaction"
         }),
         search.createColumn({
            name: "linesequencenumber",
            join: "appliedToTransaction",
            label: "Line Sequence Number"
         })
      ]
   });
   var searchResultCount = vendorbillSearchObj.runPaged().count;
   log.debug("vendorbillSearchObj result count",searchResultCount);
   vendorbillSearchObj.run().each(function(result){
      // .run().each has a limit of 4,000 results
      return true;
   });
   
   
   vendorbillSearchObj.id="customsearch_mb_applied_po";
   vendorbillSearchObj.title="Bill Applied to Search ";
   var newSearchId = vendorbillSearchObj.save();
   
}
});