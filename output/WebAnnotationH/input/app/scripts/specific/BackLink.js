const $ = require('jquery')
const _ = require('lodash')
//const swal = require('sweetalert2')

class BackLink{
  //
  static async createSpreadsheetLink(){
	if (err || primaryStudyRow === 0) {
	  console.log('Error')
	}
	else {
	  return new Promise((resolve)=>{
	    let rowInSheet = primaryStudyRow + 1
	    let spreadsheetId = window.abwa.specific.mappingStudyManager.mappingStudy.spreadsheetId
	    let sheetId = window.abwa.specific.mappingStudyManager.mappingStudy.sheetId
	    // Construct link to spreadsheet
	    this.linkToSLR = document.createElement('a')
	    this.linkToSLR.href = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/edit#gid=' + sheetId + '&range=A' + rowInSheet
	    this.linkToSLR.innerText = 'Back to spreadsheet' // TODO i18n
	    this.linkToSLR.target = '_blank'
	    resolve(this.linkToSLR)
	  })
	}
  }
  //

  //
}

module.exports = BackLink