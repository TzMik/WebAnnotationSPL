const _ = require('lodash')

const ContentTypeManager = require('./ContentTypeManager')
//PVSCL:IFCOND(ModeSelector)
const ModeManager = require('./ModeManager')
//PVSCL:ENDCOND
const Sidebar = require('./Sidebar')
const TagManager = require('./TagManager')
//PVSCL:IFCOND(Student AND Teacher)
const RolesManager = require('./RolesManager')
//PVSCL:ENDCOND
//PVSCL:IFCOND(GroupSelector)
const GroupSelector = require('./GroupSelector')
//PVSCL:ENDCOND
const AnnotationBasedInitializer = require('./AnnotationBasedInitializer')
//PVSCL:IFCOND(GroupSelector)
const ConfigDecisionHelper = require('./ConfigDecisionHelper')
//PVSCL:ENDCOND
//PVSCL:IFCOND(NOT(Spreadsheet))
const Config = require('../Config')
//PVSCL:ENDCOND
//PVSCL:IFCOND(UserFilter)
const UserFilter = require('./UserFilter')
//PVSCL:ENDCOND
const HypothesisClientManager = require('../hypothesis/HypothesisClientManager')
//PVSCL:IFCOND(Moodel)
const RubricManager = require('./RubricManager')
//PVSCL:ENDCOND
const TextAnnotator = require('./contentAnnotators/TextAnnotator')
//PVSCL:IFCOND(Toolset)
const Toolset = require('../specific/ToolsetBar')
//PVSCL:ENDCOND

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
            //PVSCL:IFCOND(GroupSelector)
            window.abwa.sidebar = new Sidebar()
            window.abwa.sidebar.init(() => {
                window.abwa.groupSelector = new GroupSelector()
                window.abwa.groupSelector.init(() => {
               })
            })
            //PVSCL:ENDCOND
        } else {
          window.abwa.sidebar = new Sidebar()
          window.abwa.sidebar.init(() => {
            window.abwa.annotationBasedInitializer = new AnnotationBasedInitializer()
            window.abwa.annotationBasedInitializer.init(() => {
              //PVSCL:IFCOND(GroupSelector)
              window.abwa.groupSelector = new GroupSelector()
              window.abwa.groupSelector.init(() => {
              //PVSCL:ENDCOND
                //PVSCL:IFCOND(Student AND Teacher)
                window.abwa.roleManager = new RolesManager()
                window.abwa.roleManager.init(() => {
                //PVSCL:ENDCOND
                //PVSCL:IFCOND(ModeSelector)
                window.abwa.modeManager = new ModeManager()
                window.abwa.modeManager.init(() => {
                //PVSCL:ENDCOND
                  //PVSCL:IFCOND(DefaultCriterias)
                  window.abwa.tagManager = new TagManager(Config.review.namespace, Config.review.tags)
                  window.abwa.tagManager.init(() => {
                    window.abwa.contentAnnotator = new TextAnnotator(Config.review)
                    window.abwa.contentAnnotator.init(() => {
                  //PVSCL:ENDCOND
                      //PVSCL:IFCOND(Toolset)
                      window.abwa.specificContentManager = new Toolset(Config.review)
                      window.abwa.specificContentManager.init(() => {
                      //PVSCL:ENDCOND
                        //PVSCL:IFCOND(GroupSelector)
                        // Reload for first time the content by group
                        this.reloadContentByGroup()
                        // Initialize listener for group change to reload the content
                        this.initListenerForGroupChange()
                        // PVSCL:ENDCOND
                        this.status = ContentScriptManager.status.initialized
                        console.log('Initialized content script manager')
                      //PVSCL:IFCOND(Toolset)
                      })
                      //PVSCL:ENDCOND
                  //PVSCL:IFCOND(DefaultCriterias)
                    })
                  })
                  //PVSCL:ENDCOND
                //PVSCL:IFCOND(ModeSelector)
                })
                //PVSCL:ENDCOND
                //PVSCL:IFCOND(Student AND Teacher)
                })
                //PVSCL:ENDCOND
              //PVSCL:IFCOND(GroupSelector)
              })
              //PVSCL:ENDCOND
            })
          })
        }
      })
    })
  }

  //PVSCL:IFCOND(GroupSelector)
  initListenerForGroupChange () {
    this.events.groupChangedEvent = this.groupChangedEventHandlerCreator()
    document.addEventListener(GroupSelector.eventGroupChange, this.events.groupChangedEvent, false)
  }
  
  groupChangedEventHandlerCreator () {
    return (event) => {
      this.reloadContentByGroup()
    }
  }
  //PVSCL:ENDCOND

  reloadContentByGroup (callback) {
    //PVSCL:IFCOND(GroupSelector)
    ConfigDecisionHelper.decideWhichConfigApplyToTheGroup(window.abwa.groupSelector.currentGroup, (config) => {
      // If not configuration is found
      if (_.isEmpty(config)) {
          // TODO Inform user no defined configuration found
          console.debug('No supported configuration found for this group')
          this.destroyAugmentationOperations()
          this.destroyTagsManager()
          this.destroyUserFilter()
          this.destroyContentAnnotator()
          this.destroySpecificContentManager()
      } else {
    //PVSCL:ENDCOND
        //PVSCL:IFCOND(Marks)
        let config = Config.exams // Configuration for this tool is exams
        //PVSCL:ENDCOND
        //PVSCL:IFCOND(Student AND Teacher)
        this.reloadRolesManager(config, () => {
        //PVSCL:ENDCOND
          //PVSCL:IFCOND(Moodle)
          this.reloadRubricManager(config, () => {
          //PVSCL:ENDCOND
            //PVSCL:IFCOND(Toolset)
            // Initialize sidebar toolset
            this.initToolset()
            //PVSCL:ENDCOND
            // Tags manager should go before content annotator, depending on the tags manager, the content annotator can change
            //PVSCL:IFCOND(NOT(DefaultCriterias))
            this.reloadTagsManager(config, () => {
              this.reloadContentAnnotator(config, () => {
                if (config.userFilter) {
                  this.reloadUserFilter(config, () => {
                    this.reloadSpecificContentManager(config)
                  })
                } else {
                  this.reloadSpecificContentManager(config)
                }
              })
            })
            //PVSCL:ENDCOND
          //PVSCL:IFCOND(Moodle)
          })
          //PVSCL:ENDCOND
        //PVSCL:IFCOND(Student AND Teacher)
        })
        //PVSCL:ENDCOND
    //PVSCL:IFCOND(GroupSelector)
      }
    })
    //PVSCL:ENDCOND
  }

  //PVSCL:IFCOND(NOT(DefaultCriterias))
  reloadContentAnnotator (config, callback) {
    // Destroy current content annotator
    this.destroyContentAnnotator()
    // Create a new content annotator for the current group
    if (config.contentAnnotator === 'text') {
      window.abwa.contentAnnotator = new TextAnnotator(config)
    } else {
      window.abwa.contentAnnotator = new TextAnnotator(config) // TODO Depending on the type of annotator
    }
    window.abwa.contentAnnotator.init(callback)
  }

  reloadTagsManager (config, callback) {
    // Destroy current tag manager
    this.destroyTagsManager()
    // Create a new tag manager for the current group
    window.abwa.tagManager = new TagManager(config.namespace, config.tags) // TODO Depending on the type of annotator
    window.abwa.tagManager.init(callback)
  }

  reloadSpecificContentManager (config, callback) {
    // Destroy current specific content manager
    this.destroySpecificContentManager()
    const SLRDataExtractionContentScript = require('../specific/specificContentScript')
    window.abwa.specificContentManager = new SLRDataExtractionContentScript(config)
    window.abwa.specificContentManager.init()
  }

  destroySpecificContentManager () {
    if (window.abwa.specificContentManager) {
      window.abwa.specificContentManager.destroy()
    }
  }
  //PVSCL:ENDCOND
  //PVSCL:IFCOND(Toolset)
  initToolset () {
      window.abwa.toolset = new Toolset() // Esto hay que cambiarlo
      window.abwa.toolset.init()
  }
  //PVSCL:ENDCOND

  //PVSCL:IFCOND(Moodle)
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
  //PVSCL:ENDCOND

  //PVSCL:IFCOND(Student AND Teacher)
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
  //PVSCL:ENDCOND

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

  //PVSCL:IFCOND(UserFilter)
  reloadUserFilter (config, callback) {
    // Destroy user filter
    this.destroyUserFilter()
    // Create user filter
    window.abwa.userFilter = new UserFilter(config)
    window.abwa.userFilter.init(callback)
  }
    
  destroyUserFilter (callback) {
    // Destroy current user filter
    if (!_.isEmpty(window.abwa.userFilter)) {
      window.abwa.userFilter.destroy()
    }
  }
  //PVSCL:ENDCOND

  destroy (callback) {
    console.log('Destroying content script manager')
    this.destroyContentTypeManager(() => {
      this.destroyAugmentationOperations()
      this.destroyTagsManager()
      this.destroyContentAnnotator()
      //PVSCL:IFCOND(UserFilter)
      this.destroyUserFilter()
      //PVSCL:ENDCOND
      window.abwa.groupSelector.destroy(() => {
        window.abwa.sidebar.destroy(() => {
          window.abwa.hypothesisClientManager.destroy(() => {
            this.status = ContentScriptManager.status.notInitialized
            if (_.isFunction(callback)) {
            }
          })
        })
      })
      //PVSCL:IFCOND(GroupSelector)
      document.removeEventListener(GroupSelector.eventGroupChange, this.events.groupChangedEvent)
      //PVSCL:ENDCOND
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