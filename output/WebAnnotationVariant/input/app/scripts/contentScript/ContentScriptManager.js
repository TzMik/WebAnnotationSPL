const _ = require('lodash')

const ContentTypeManager = require('./ContentTypeManager')
// const ModeManager = require('./ModeManager')
const Sidebar = require('./Sidebar')
//const TagManager = require('./TagManager')
//
const RolesManager = require('./RolesManager')
//
const GroupSelector = require('./GroupSelector')
const AnnotationBasedInitializer = require('./AnnotationBasedInitializer')
//
//
const Config = require('../Config')
//
//
const HypothesisClientManager = require('../hypothesis/HypothesisClientManager')
const RubricManager = require('./RubricManager')
//const TextAnnotator = require('./contentAnnotators/TextAnnotator')

class ContentScriptManager {
  constructor () {
    this.events = {}
    this.status = ContentScriptManager.status.notInitialized
  }

  init () {
    console.log('Initializing content script manager')
    this.status = ContentScriptManager.status.initializing
    this.loadContentTypeManager(() => {
      window.abwa.hypothesisClientManager = new HypothesisClientManager()
      window.abwa.hypothesisClientManager.init((err) => {
        if (err) {
            //
        } else {
          window.abwa.sidebar = new Sidebar()
          window.abwa.sidebar.init(() => {
            window.abwa.annotationBasedInitializer = new AnnotationBasedInitializer()
            window.abwa.annotationBasedInitializer.init(() => {
              window.abwa.groupSelector = new GroupSelector()
              window.abwa.groupSelector.init(() => {
                //
                window.abwa.roleManager = new RolesManager()
                window.abwa.roleManager.init(() => {
                //
                //window.abwa.modeManager = new ModeManager()
                //window.abwa.modeManager.init(() => {
                  //
                      //
                        //
                        this.status = ContentScriptManager.status.initialized
                        console.log('Initialized content script manager')
                      //
                  //
                //})
                //
                })
                //
              })
            })
          })
        }
      })
    })
  }

  //

  //

  //
  reloadRubricManager (config, callback) {
    this.destroyRubricManager()
    window.abwa.rubricManager = new RubricManager(config)
    window.abwa.rubricManager.init(callback)
  }

  destroyRubricManager (callback) {
    if (!_.isEmpty(window.abwa.rubricManager)) {
      window.abwa.rubricManager.destroy()
    }
  }
  //

  //
  reloadRolesManager (config, callback) {
    // Destroy current role manager
    this.destroyRolesManager()
    // Create a role manager for the current group
    window.abwa.roleManager = new RolesManager(config)
    window.abwa.roleManager.init()
    if (_.isFunction(callback)) {
      callback()
    }
  }

  destroyRolesManager (callback) {
    if (!_.isEmpty(window.abwa.roleManager)) {
      window.abwa.roleManager.destroy()
    }
  }
  //

  destroyContentAnnotator () {
    // Destroy current content annotator
    if (!_.isEmpty(window.abwa.contentAnnotator)) {
      window.abwa.contentAnnotator.destroy()
    }
  }

  destroyTagsManager () {
    if (!_.isEmpty(window.abwa.tagManager)) {
      window.abwa.tagManager.destroy()
    }
  }

  destroyAugmentationOperations () {
    // Destroy current augmentation operations
    if (!_.isEmpty(window.abwa.augmentationManager)) {
      window.abwa.augmentationManager.destroy()
    }
  }

  //

  destroy (callback) {
    console.log('Destroying content script manager')
    this.destroyContentTypeManager(() => {
      this.destroyAugmentationOperations()
      this.destroyTagsManager()
      this.destroyContentAnnotator()
      //
      window.abwa.groupSelector.destroy(() => {
        window.abwa.sidebar.destroy(() => {
          window.abwa.hypothesisClientManager.destroy(() => {
            this.status = ContentScriptManager.status.notInitialized
            if (_.isFunction(callback)) {
            }
          })
        })
      })
      //
    })
  }

  loadContentTypeManager (callback) {
    window.abwa.contentTypeManager = new ContentTypeManager()
    window.abwa.contentTypeManager.init(() => {
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  destroyContentTypeManager (callback) {
    if (window.abwa.contentTypeManager) {
      window.abwa.contentTypeManager.destroy(() => {
        if (_.isFunction(callback)) {
          callback()
        }
      })
    }
  }
}

ContentScriptManager.status = {
  initializing: 'initializing',
  initialized: 'initialized',
  notInitialized: 'notInitialized'
}

module.exports = ContentScriptManager