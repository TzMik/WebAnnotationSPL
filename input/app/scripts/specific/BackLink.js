const $ = require('jquery')
const _ = require('lodash')
//const swal = require('sweetalert2')

class BackLink{

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