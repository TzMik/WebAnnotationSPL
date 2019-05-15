const _ = require('lodash')

const ContentTypeManager = require('./ContentTypeManager')
const Sidebar = require('./Sidebar')
const TagManager = require('./TagManager')
const GroupSelector = require('./GroupSelector')
const AnnotationBasedInitializer = require('./AnnotationBasedInitializer')
const Config = require('../Config')
const HypothesisClientManager = require('../hypothesis/HypothesisClientManager')
const TextAnnotator = require('./contentAnnotators/TextAnnotator')
const specificContentScript = require('../specific/specificContentScript')
const Toolset = require('../specific/ToolsetBar')

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
            window.abwa.sidebar = new Sidebar()
            window.abwa.sidebar.init(() => {
                window.abwa.groupSelector = new GroupSelector()
                window.abwa.groupSelector.init(() => {
               })
            })
        } else {
          window.abwa.sidebar = new Sidebar()
          window.abwa.sidebar.init(() => {
            window.abwa.annotationBasedInitializer = new AnnotationBasedInitializer()
            window.abwa.annotationBasedInitializer.init(() => {
              window.abwa.groupSelector = new GroupSelector()
              window.abwa.groupSelector.init(() => {
                  window.abwa.tagManager = new TagManager(Config.review.namespace, Config.review.tags)
                  window.abwa.tagManager.init(() => {
                    window.abwa.contentAnnotator = new TextAnnotator(Config.review)
                    window.abwa.contentAnnotator.init(() => {
                      window.abwa.specificContentManager = new specificContentScript(Config.review)
                      window.abwa.specificContentManager.init(() => {
                        this.status = ContentScriptManager.status.initialized
                        console.log('Initialized content script manager')
                  //
                      })
                    })
                  })
                  //
              })
            })
          })
        }
      })
    })
  }


  reloadContentByGroup (callback) {
            // Tags manager should go before content annotator, depending on the tags manager, the content annotator can change
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
  }




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


  destroy (callback) {
    console.log('Destroying content script manager')
    this.destroyContentTypeManager(() => {
      this.destroyAugmentationOperations()
      this.destroyTagsManager()
      this.destroyContentAnnotator()
      window.abwa.groupSelector.destroy(() => {
        window.abwa.sidebar.destroy(() => {
          window.abwa.hypothesisClientManager.destroy(() => {
            this.status = ContentScriptManager.status.notInitialized
            if (_.isFunction(callback)) {
            }
          })
        })
      })
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