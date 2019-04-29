const _ = require('lodash')
//
//
const Config = require('../Config')
//
//
const PrimaryStudySheetManager = require('./PrimaryStudySheetManager')
const MappingStudyManager = require('./MappingStudyManager')
const CreateAnnotationManager = require('./CreateAnnotationManager')
const DeleteAnnotationManager = require('./DeleteAnnotationManager')
//
//
//
//
const Toolset = require('./ToolsetBar')
//
//

class specificContentScript{
  //
  constructor () {
    this.backToSpreadsheetLink = null
    this.spreadsheetId = null
    this.tags = {
      isFacetOf: Config.slrDataExtraction.namespace + ':' + Config.slrDataExtraction.tags.grouped.relation + ':',
      facet: Config.slrDataExtraction.namespace + ':' + Config.slrDataExtraction.tags.grouped.group + ':',
      code: Config.slrDataExtraction.namespace + ':' + Config.slrDataExtraction.tags.grouped.subgroup + ':'
    }
  }
  //

  init (callback) {
    window.abwa.specific = window.abwa.specific || {}
    
    //
    //
    window.abwa.specific = window.abwa.specific || {}
    // Retrieve mapping study manager
    window.abwa.specific.mappingStudyManager = new MappingStudyManager()
    window.abwa.specific.mappingStudyManager.init(() => {
      // Retrieve primary study sheet
      window.abwa.specific.primaryStudySheetManager = new PrimaryStudySheetManager()
      window.abwa.specific.primaryStudySheetManager.init(() => {
        // Create annotation handler
        window.abwa.specific.createAnnotationManager = new CreateAnnotationManager()
        window.abwa.specific.createAnnotationManager.init()
        // Delete annotation handler
        window.abwa.specific.deleteAnnotationManager = new DeleteAnnotationManager()
        window.abwa.specific.deleteAnnotationManager.init()
        // Validation handler
        window.abwa.specific.validateAnnotationManager = new ValidateAnnotationManager()
        window.abwa.specific.validateAnnotationManager.init()
        window.abwa.toolset.show()
        if (_.isFunction(callback)) {
          callback()
        }
      })
    })
    //
    //
    //
    window.abwa.toolset.show()
    //
  }

  //

  destroy(){
    //
    // TODO Destroy managers
    window.abwa.specific.mappingStudyManager.destroy()
    window.abwa.specific.primaryStudySheetManager.destroy()
    window.abwa.specific.createAnnotationManager.destroy()
    window.abwa.specific.deleteAnnotationManager.destroy()
    window.abwa.specific.validateAnnotationManager.destroy()
    //
  }
}

module.exports = specificContentScript