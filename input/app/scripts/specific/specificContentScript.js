const _ = require('lodash')
//PVSCL:IFCOND(Moodle, LINE)
const jsYaml = require('js-yaml')
//PVSCL:ENDCOND
//PVSCL:IFCOND(NOT(DefaultCriterias), LINE)
const Config = require('../Config')
//PVSCL:ENDCOND
//PVSCL:IFCOND(Spreadsheet, LINE)
const PrimaryStudySheetManager = require('./PrimaryStudySheetManager')
const MappingStudyManager = require('./MappingStudyManager')
const CreateAnnotationManager = require('./CreateAnnotationManager')
const DeleteAnnotationManager = require('./DeleteAnnotationManager')
//PVSCL:ENDCOND
//PVSCL:IFCOND(Validations, LINE)
const ValidateAnnotationManager = require('./ValidateAnnotationManager')
//PVSCL:ENDCOND
//PVSCL:IFCOND(Moodle, LINE)
const MoodleGradingManager = require('./MoodleGradingManager')
const MoodleCommentManager = require('./MoodleCommentManager')
const AssessmentManager = require('./AssessmentManager')
//PVSCL:ENDCOND
//PVSCL:IFCOND(Toolset, LINE)
const Toolset = require('./ToolsetBar')
//PVSCL:ENDCOND
//PVSCL:IFCOND(New, LINE)
const CustomCriteriasManager = require('./CustomCriteriasManager')
//PVSCL:ENDCOND

class specificContentScript{
  //PVSCL:IFCOND(Spreadsheet, LINE)
  constructor () {
    this.backToSpreadsheetLink = null
    this.spreadsheetId = null
    this.tags = {
      isFacetOf: Config.slrDataExtraction.namespace + ':' + Config.slrDataExtraction.tags.grouped.relation + ':',
      facet: Config.slrDataExtraction.namespace + ':' + Config.slrDataExtraction.tags.grouped.group + ':',
      code: Config.slrDataExtraction.namespace + ':' + Config.slrDataExtraction.tags.grouped.subgroup + ':'
    }
  }
  //PVSCL:ENDCOND

  init (callback) {
    window.abwa.specific = window.abwa.specific || {}
    //PVSCL:IFCOND(Toolset AND DefaultCriterias, LINE)
    window.abwa.toolset = new Toolset()
    window.abwa.toolset.init(() => {

    })
    //PVSCL:ENDCOND
    //PVSCL:IFCOND(New, LINE)
    window.abwa.specific.customCriteriasManager = new CustomCriteriasManager()
    window.abwa.specific.customCriteriasManager.init(() => {

    })
    //PVSCL:ENDCOND
    //PVSCL:IFCOND(Spreadsheet, LINE)
    window.abwa.specific = window.abwa.specific || {}
    // Retrieve mapping study manager
    window.abwa.specific.mappingStudyManager = new MappingStudyManager()
    window.abwa.specific.mappingStudyManager.init(() => {
      // Retrieve primary study sheet
      window.abwa.specific.primaryStudySheetManager = new PrimaryStudySheetManager()
      window.abwa.specific.primaryStudySheetManager.init(() => {
    	//PVSCL:IFCOND(Toolset, LINE)
    	window.abwa.toolset = new Toolset() // Esto hay que cambiarlo
        window.abwa.toolset.init()
    	//PVSCL:ENDCOND
        // Create annotation handler
        window.abwa.specific.createAnnotationManager = new CreateAnnotationManager()
        window.abwa.specific.createAnnotationManager.init()
        // Delete annotation handler
        window.abwa.specific.deleteAnnotationManager = new DeleteAnnotationManager()
        window.abwa.specific.deleteAnnotationManager.init()
        // Validation handler
        window.abwa.specific.validateAnnotationManager = new ValidateAnnotationManager()
        window.abwa.specific.validateAnnotationManager.init()
        //window.abwa.toolset.show()
        if (_.isFunction(callback)) {
          callback()
        }
      })
    })
    //PVSCL:ELSEIFCOND(Moodle, LINE)
    // Enable different functionality if current user is the teacher or student
    this.currentUserIsTeacher((err, isTeacher) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        if (isTeacher) { // Open modes
          window.abwa.specific = window.abwa.specific || {}
  
          window.abwa.specific.moodleGradingManager = new MoodleGradingManager()
          window.abwa.specific.moodleGradingManager.init()
  
          window.abwa.specific.assessmentManager = new AssessmentManager({
            cmid: window.abwa.rubricManager.rubric.cmid
          })
          window.abwa.specific.assessmentManager.init()
          //PVSCL:IFCOND(Toolset, LINE)
          // Toolset show
          window.abwa.toolset.show()
          //PVSCL:ENDCOND
        } else { // Change to viewing mode
          window.abwa.specific = window.abwa.specific || {}
          window.abwa.tagManager.showViewingTagsContainer()
          window.abwa.sidebar.openSidebar()
          //PVSCL:IFCOND(Toolset, LINE)
          // Toolset hide
          window.abwa.toolset.hide()
          //PVSCL:ENDCOND
          // Log student reviewed the exam
          // window.abwa.specific.studentLogging = new StudentLogging()
          // window.abwa.specific.studentLogging.init()
          if (_.isFunction(callback)) {
            callback()
          }
        }
        //PVSCL:IFCOND(Replys, LINE)
        // Enable handler for replies
        window.abwa.specific.moodleCommentManager = new MoodleCommentManager()
        window.abwa.specific.moodleCommentManager.init()
        //PVSCL:ENDCOND
      }
      
    })
    //PVSCL:ENDCOND
    //PVSCL:IFCOND(NOT(Moodle) AND Toolset, LINE)
    //window.abwa.toolset.show()
    //PVSCL:ENDCOND
  }

  //PVSCL:IFCOND(Moodle, LINE)
  currentUserIsTeacher (callback) {
    window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
      url: window.abwa.groupSelector.currentGroup.url,
      order: 'desc',
      tags: Config.exams.namespace + ':' + Config.exams.tags.statics.teacher
    }, (err, annotations) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        if (annotations.length > 0) {
          let params = jsYaml.load(annotations[0].text)
          callback(null, params.teacherId === window.abwa.groupSelector.user.userid) // Return if current user is teacher
        } else {
          if (_.isFunction(callback)) {
            callback(null)
          }
        }
      }
    })
  }
  //PVSCL:ENDCOND

  destroy(){
    //PVSCL:IFCOND(Spreadsheet, LINE)
    // TODO Destroy managers
    window.abwa.specific.mappingStudyManager.destroy()
    window.abwa.specific.primaryStudySheetManager.destroy()
    window.abwa.specific.createAnnotationManager.destroy()
    window.abwa.specific.deleteAnnotationManager.destroy()
    window.abwa.specific.validateAnnotationManager.destroy()
    //PVSCL:ELSEIFCOND(Moodle, LINE)
    try {
      if (window.abwa.specific) {
        if (window.abwa.specific.moodleGradingManager) {
          window.abwa.specific.moodleGradingManager.destroy()
        }
      }
    } catch (e) {
      // TODO Show user need to reload the page?
    }
    //PVSCL:ENDCOND
  }
}

module.exports = specificContentScript