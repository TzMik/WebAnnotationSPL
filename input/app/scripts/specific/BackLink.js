const $ = require('jquery')
const _ = require('lodash')
//const swal = require('sweetalert2')

class BackLink{
  //PVSCL:IFCOND(BackToSpreadsheet, LINE)
  static async createSpreadsheetLink(){
	window.abwa.specific.primaryStudySheetManager.retrievePrimaryStudyRow((err, primaryStudyRow) => {
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
	},false)
  }
  //PVSCL:ENDCOND

  //PVSCL:IFCOND(BackToMoodle, LINE)
  static async createWorkspaceLink () {
    return new Promise((resolve) => {
      this.linkToWorkspace = document.createElement('a')
      if (window.abwa.rubricManager.rubric) {
        let rubric = window.abwa.rubricManager.rubric
        let studentId = window.abwa.contentTypeManager.fileMetadata.studentId
        this.linkToWorkspace.href = rubric.moodleEndpoint + 'mod/assign/view.php?id=' + rubric.cmid + '&rownum=0&action=grader&userid=' + studentId
        this.linkToWorkspace.target = '_blank'
      }
      resolve(this.linkToWorkspace)
    })
  }
  //PVSCL:ENDCOND
}

module.exports = BackLink