/**
 * @NApiVersion 2.x
 * @NScriptType Restlet
 * @NModuleScope Public
 */
define(['N/record', 'N/file', 'N/query', 'N/error'],
/**
 * @param {record} record
 * @param {file} file
 * @param {query} query
 * @param {error} error
 */
function (record, file, query, error) {
  /**
   * Function called upon sending a POST request to the RESTlet.
   *
   * This is a SuiteScript. Here's a helpful place to start in the SuiteScript documentation
   * https://2380437.app.netsuite.com/app/help/helpcenter.nl?fid=section_4267255811.html#bridgehead_4273190849
   *
   * In order to debug this script
   * 1. https://debugger.na2.netsuite.com/app/common/scripting/scriptdebugger.nl
   * 2. Basically copy-paste this file into the script debugger
   * 3. Replace `define` up-top with `require`
   * 4. Hardcode requestBody
   * 5. Replace `return { 'post': doPost };` with, like, `return doPost(myRequestBody);`
   *
   * @param {string | Object} requestBody - The HTTP request body; request body
   * will be passed into function as a string when request Content-Type is
   * 'text/plain' or parsed into an Object when request Content-Type is
   * 'application/json' (in which case the body must be a valid JSON)
   * @returns {string | Object} HTTP response body; return string when request
   * Content-Type is 'text/plain'; return Object when request Content-Type is
   * 'application/json'
   * @since 2015.2
   */
  function doPost(requestBody) {
    log.debug('Post body', requestBody);
    try {
      if ('action' in requestBody) {
        var action = requestBody.action;
        if (action === 'exists') {
          return RecordExists(requestBody);
        } else if (action === 'attachFile') {
          return AttachNetsuiteFile(requestBody);
        } else if (action === 'fetch') {
          return FetchRecord(requestBody);
        } else if (action === 'fetchFields') {
          return FetchRecordFields(requestBody);
        } else if (action === 'fetchAll') {
          return FetchAllRecords(requestBody);
        } else if (action === 'delete') {
          return DeleteRecord(requestBody);
        }
      }


      if (requestBody.transactionType === "VendorPayment") {
        var internalId = CreateVendorBillPayment(requestBody);
      } else if (requestBody.transactionType === "CreateFile") {
        var internalId = CreateFile(requestBody);
      } else {
        var internalId = SaveRecord(requestBody);
      }

    } catch (error) {
      return {'error': error}
    }

    log.debug('Saved id', internalId);
    return {'internalId': internalId};
  }

  function RecordExists(requestBody) {
    var exists;
    try {
      record.load({ type: requestBody.transactionType, id: requestBody.internalid });
      exists = true;
    } catch (error) {
      if (error["name"] === "RCRD_DSNT_EXIST") {
        exists = false;
      } else {
        throw(error);
      }
    }
    return { 'exists': exists };
  }

  function FetchRecord(requestBody) {
    var thisRecord = record.load(
      { type: requestBody.transactionType, id: requestBody.internalid }
    );

    var recordData = {};
    var fields = thisRecord.getFields();
    for (var i = 0; i < fields.length; i++) {
      var fieldName = fields[i];
      var value = thisRecord.getValue(fieldName);
      if (value !== "") {
        recordData[fieldName] = value;
      }
    }

    var sublists = thisRecord.getSublists();
    for (var i = 0; i < sublists.length; i++) {
      var sublistName = sublists[i];
      var lineCount = thisRecord.getLineCount(sublistName);
      if (lineCount > 0) {
        var sublistFields = thisRecord.getSublistFields(sublistName);
        var sublist = [];
        recordData[sublistName] = sublist;
        for (var lineIndex = 0; lineIndex < lineCount; lineIndex++) {
          var line = {};
          sublist.push(line);
          for (var j = 0; j < sublistFields.length; j++) {
            var field = sublistFields[j];
            var value = thisRecord.getSublistValue({
                  sublistId: sublistName,
                  fieldId: field,
                  line: lineIndex
              });
            if (value !== "") {
              line[field] = value;
            }
          }
        }
      }
    }
    return recordData;
  }

  function FetchRecordFields(requestBody) {
    var thisRecord = record.load(
      { type: requestBody.transactionType, id: requestBody.internalid }
    );
    var fields = thisRecord.getFields();
    return fields
  }

  function FetchAllRecords(requestBody) {
    if (requestBody.queryType === "account") {
      var queryType = query.Type.ACCOUNT;
    } else if (requestBody.queryType === "vendor") {
      var queryType = query.Type.VENDOR;
    } else if (requestBody.queryType === "customer") {
      var queryType = query.Type.CUSTOMER;
    } else if (requestBody.queryType === "class") {
      var queryType = query.Type.CLASSIFICATION;
    } else if (requestBody.queryType === "department") {
      var queryType = query.Type.DEPARTMENT;
    } else if (requestBody.queryType === "subsidiary") {
      var queryType = query.Type.SUBSIDIARY;
    } else if (requestBody.queryType === "location") {
      var queryType = query.Type.LOCATION;
    } else if (requestBody.queryType === "currency") {
      var queryType = query.Type.CURRENCY;
    } else if (requestBody.queryType === "transaction") {
      var queryType = query.Type.TRANSACTION;
    } else {
      var unsupportedQueryTypeError = error.create({
        name: 'UNSUPPORTED_QUERY_TYPE',
        message: '[' + requestBody.queryType + '] is not a supported attribute type for queries.',
        notifyOff: false
      });
      throw unsupportedQueryTypeError;
    }

    var fetchAllQuery = query.create({type: queryType});
    var columnList = [];
    for (var i = 0; i < requestBody.columns.length; i++) {
      columnList.push(fetchAllQuery.createColumn({
        fieldId: requestBody.columns[i]
      }))
    }
    if (requestBody.joins) {
      for (var i = 0; i < requestBody.joins.length; i++) {
        var joinType = requestBody.joins[i];
        var join = fetchAllQuery.autoJoin({
          fieldId: joinType.name
        });
        for (var i = 0; i < joinType.columns.length; i++) {
          columnList.push(
            join.createColumn({
              fieldId: joinType.columns[i],
              alias: joinType.name.concat('_', joinType.columns[i])
            })
          )
        }
      }
    }
    var conditions = []
    if (requestBody.filters) {
      for (var i = 0; i < requestBody.filters.length; i++) {
        var filter_pair = requestBody.filters[i]
        conditions.push(fetchAllQuery.createCondition({
        fieldId: filter_pair.fieldName,
        operator: filter_pair.operator,
        values: filter_pair.fieldValue
        }));
      }
      fetchAllQuery.condition = fetchAllQuery.and(conditions)
    }
    fetchAllQuery.columns = columnList

    var result = [];
    var pagedData = fetchAllQuery.runPaged({pageSize: 5000});
    for (var i = 0; i < pagedData.pageRanges.length; i++) {
      var currentPage = pagedData.fetch(i);
      var formattedResults = currentPage.data.asMappedResults();
      result.push.apply(result, formattedResults)
    }

    return result
  }

  function DeleteRecord(requestBody) {
    record.delete({
      type: requestBody.transactionType,
      id: requestBody.internalid
    });
    return {'deleted': true};
  }

  function AttachNetsuiteFile(requestBody) {
    record.attach({
      record: {
        type: 'file',
        id: requestBody.fileId
      },
      to: {
        type: requestBody.transactionType,
        id: requestBody.recordId
      }
    });

    return { 'attached': true };
  }

  function CreateVendorBillPayment(requestBody) {
    var vendorBillPayment = record.transform(
      {
        fromType:'vendorbill',
        fromId: parseInt(requestBody.billInternalId),
        toType:'vendorpayment'
      }
    );
    if (requestBody.account) {
      vendorBillPayment.setValue({
        fieldId: 'account',
        value: valueForNetsuite(requestBody.account),
      });
    }
    lineCount = vendorBillPayment.getLineCount({sublistId:'apply'});
    for (var i = 0; i < lineCount; i++) {
      var listBillId = vendorBillPayment.getSublistValue(
        { sublistId: 'apply', fieldId: 'doc', line: i }
      );
      if (requestBody.billInternalId === listBillId) {
        vendorBillPayment.setSublistValue(
          { sublistId: 'apply', fieldId: 'apply', line: i, value: true });
      }
    }
    return vendorBillPayment.save({});
  }

  function CreateFile(requestBody) {
    if (requestBody.transactionFields.fileType === 'pdf') {
      var fileType = file.Type.PDF;
    } else if (requestBody.transactionFields.fileType === 'png') {
      var fileType = file.Type.PNGIMAGE;
    } else if (
      requestBody.transactionFields.fileType === 'jpg' ||
      requestBody.transactionFields.fileType === 'jpeg'
    ) {
      var fileType = file.Type.JPGIMAGE;
    } else {
      var unsupportedFileType = error.create({
        name: 'UNSUPPORTED_FILE_TYPE',
        message: '[' + requestBody.fileType + '] is not a supported file type for attachments.',
        notifyOff: false
      });
      throw unsupportedFileType;
    }

    var thisFile = file.create({
      'name': requestBody.transactionFields.name,
      'folder': requestBody.transactionFields.folder,
      'contents': requestBody.transactionFields.contents,
      'encoding': file.Encoding.UTF_8,
      'fileType': fileType
    });
    return thisFile.save({});
  }

  function SaveRecord(requestBody) {
    /* Create or update depending on whether you include an internalid in your request. */
    var creating = !requestBody.internalid;
    if (creating) {
      /* https://2380437.app.netsuite.com/app/help/helpcenter.nl?fid=section_4205869719.html
       * Dynamic mode validates fields _as you set them_ which basically means
       * that if you, for example, set the account of a credit card refund
       * before you set the entity/vendor, it'll blow up and tell you the
       * account is wrong.
       */
      var thisRecord = record.create({ type: requestBody.transactionType, isDynamic: false });
    } else {
      var thisRecord = record.load(
        { type: requestBody.transactionType, id: requestBody.internalid }
      );
    }
    for (var key in requestBody.transactionFields) {
        thisRecord.setValue(
            {fieldId: key, value: valueForNetsuite(requestBody.transactionFields[key])}
        );
    }
    if (requestBody.linesAreCalled) {  // For example, "expense"
      for (var lineIndex = 0; lineIndex < requestBody.lines.length; lineIndex++) {
        line = requestBody.lines[lineIndex];
        if (creating) {
          thisRecord.insertLine({ sublistId: requestBody.linesAreCalled, line: lineIndex });
        }
        for (var key in line) {
          thisRecord.setSublistValue({
              sublistId: requestBody.linesAreCalled,
              fieldId: key,
              line: lineIndex,
              value: valueForNetsuite(line[key])
          });
        }
      }
    }
    return thisRecord.save({});
  }

  function valueForNetsuite(value) {
    var dateFinder = /^\d+\/\d+\/\d+$/;
    if (typeof value === 'string' && value.match(dateFinder)) {
        return new Date(value);
    }
    return value;
  }

  return { 'post': doPost };
});
