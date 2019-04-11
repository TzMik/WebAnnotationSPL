const _ = require('lodash')
const $ = require('jquery')
//PVSCL:IFCOND(GroupSelector)
const ChromeStorage = require('../utils/ChromeStorage')
const LanguageUtils = require('../utils/LanguageUtils')
const checkHypothesisLoggedInWhenPromptInSeconds = 2 // When not logged in, check if user has logged in
const selectedGroupNamespace = 'hypothesis.currentGroup'
const defaultGroup = {id: '__world__', name: 'Public', public: true}
//PVSCL:ENDCOND
const Alerts = require('../utils/Alerts')
//PVSCL:IFCOND(Student)
const CryptoUtils = require('../utils/CryptoUtils')
//PVSCL:ENDCOND
const Config = require('../Config')
//PVSCL:IFCOND(DefaultCriterias)
const DefaultHighlighterGenerator = require('../specific/DefaultHighlighterGenerator')
//PVSCL:ENDCOND
//PVSCL:IFCOND(StaticGroupSelector)
const GroupName = Config.review.groupName
//PVSCL:ENDCOND

class GroupSelector {
  constructor () {
    //PVSCL:IFCOND(AutomaticSelection)
    this.groups = null
    //PVSCL:ENDCOND
    this.currentGroup = null
    this.user = {}
  }

  init (callback) {
    //PVSCL:IFCOND(AutomaticSelection OR StaticGroupSelector)
    console.debug('Initializing group selector')
    this.checkIsLoggedIn((err) => {
      if (err) {
        // Stop propagating the rest of the functions, because it is not logged in hypothesis
        // Show that user need to log in hypothes.is to continue
        Alerts.errorAlert({
          title: 'Log in Hypothes.is required',
          text: chrome.i18n.getMessage('HypothesisLoginRequired')
        })
      } else {
        // Retrieve user profile (for further uses in other functionalities of the tool)
        this.retrieveUserProfile(() => {
          // Define current group
          this.defineCurrentGroup(() => {
            console.debug('Initialized group selector')
            if (_.isFunction(callback)) {
              callback(null)
            }
          })
        })
      }
    })
    //PVSCL:ELSEIFCOND(GroupSelector)
    console.debug('Initializing group selector')
    this.addGroupSelectorToSidebar(() => {
      this.reloadGroupsContainer(() => {
        if (_.isFunction(callback)) {
          callback()
        }
      })
    })
    //PVSCL: ELSECOND
    //PVSCL:ENDCOND
  }

  //PVSCL:IFCOND(GroupSelector)
  addGroupSelectorToSidebar (callback) {
    let sidebarURL = chrome.extension.getURL('pages/sidebar/groupSelection.html')
    $.get(sidebarURL, (html) => {
      // Append sidebar to content
      $('#abwaSidebarContainer').append($.parseHTML(html))
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }
  //PVSCL:ENDCOND

  defineCurrentGroup (callback) {
    //PVSCL:IFCOND(GroupSelector)
    // If initialization annotation is set
    if (window.abwa.annotationBasedInitializer.initAnnotation) {
      let annotationGroupId = window.abwa.annotationBasedInitializer.initAnnotation.group
      // Load group of annotation
      this.retrieveHypothesisGroups((err, groups) => {
        if (err) {
          if (_.isFunction(callback)) {
            callback(err)
          }
        } else {
          // Set current group
          this.currentGroup = _.find(groups, (group) => { return group.id === annotationGroupId })
          // Save to chrome storage current group
          ChromeStorage.setData(selectedGroupNamespace, {data: JSON.stringify(this.currentGroup)}, ChromeStorage.local)
          if (_.isFunction(callback)) {
            callback()
          }
        }
      })
    } else { // If initialization annotation is not set
      if (!this.currentGroup) {
        // Retrieve last saved group
        ChromeStorage.getData(selectedGroupNamespace, ChromeStorage.local, (err, savedCurrentGroup) => {
          if (err) {
            if (_.isFunction(callback)) {
              callback(new Error('Unable to retrieve current selected group'))
            }
          } else {
            // Parse chrome storage result
            if (!_.isEmpty(savedCurrentGroup) && savedCurrentGroup.data) {
              this.currentGroup = JSON.parse(savedCurrentGroup.data)
            } else {
              this.currentGroup = defaultGroup
            }
            if (_.isFunction(callback)) {
              callback()
            }
          }
        })
      } else {
        if (_.isFunction(callback)) {
          callback()
        }
      }
    }
    //PVSCL:ELSECOND
    //PVSCL:IFCOND(Student)
    let fileMetadata = window.abwa.contentTypeManager.fileMetadata
    // Get group name from file metadata
    let groupName = (new URL(fileMetadata.url)).host + fileMetadata.courseId + fileMetadata.studentId
    let hashedGroupName = 'MG' + CryptoUtils.hash(groupName).substring(0, 23)
    //PVSCL:ENDCOND
    // Load all the groups belonged to current user
    this.retrieveHypothesisGroups((err, groups) => {
      if (err) {
      } else {
        //PVSCL:IFCOND(Student)
        let group = _.find(groups, (group) => { return group.name === hashedGroupName })
        //PVSCL:ELSECOND
        let group = _.find(groups, (group) => { return group.name === GroupName })
        //PVSCL:ENDCOND
        if (_.isObject(group)) {
          // Current group will be that group
          this.currentGroup = group
          if (_.isFunction(callback)) {
            callback(null)
          }
        } else {
          //PVSCL:IFCOND(Moodle)
          // Warn user not group is defined, configure tool first
          Alerts.errorAlert({text: 'If you are a teacher you need to configure Mark&Go first.<br/>If you are a student, you need to join feedback group first.', title: 'Unable to start the application'}) // TODO i18n
          //PVSCL:ELSEIFCOND(DefaultCriterias)
          // TODO i18n
          Alerts.loadingAlert({title: 'First time reviewing?', text: 'It seems that it is your first time using the application. We are configuring everything to start reviewing.', position: Alerts.position.center})
          // TODO Create default group
          DefaultHighlighterGenerator.createReviewHypothesisGroup((err, group) => {
            if (err) {
              Alerts.errorAlert({text: 'We are unable to create Hypothes.is group for the application. Please check if you are logged in Hypothes.is.'})
            } else {
              this.currentGroup = group
              callback(null)
            }
          })
          //PVSCL:ENDCOND
        }
      }
    })
    //PVSCL:ENDCOND
  }

  //PVSCL:IFCOND(GroupSelector)
  reloadGroupsContainer (callback) {
    if (window.abwa.hypothesisClientManager.isLoggedIn()) {
      // Hide login/sign up form
      $('#notLoggedInGroupContainer').attr('aria-hidden', 'true')
      // Display group container
      $('#loggedInGroupContainer').attr('aria-hidden', 'false')
      // Set current group if not defined
      this.defineCurrentGroup(() => {
        // Render groups container
        this.renderGroupsContainer(() => {
          if (_.isFunction(callback)) {
            callback()
          }
        })
      })
    } else {
      // Display login/sign up form
      $('#notLoggedInGroupContainer').attr('aria-hidden', 'false')
      // Hide group container
      $('#loggedInGroupContainer').attr('aria-hidden', 'true')
      // Hide purposes wrapper
      $('#purposesWrapper').attr('aria-hidden', 'true')
      // Init isLogged checking
      this.initIsLoggedChecking()
      // Open the sidebar to show that login is required
      window.abwa.sidebar.openSidebar()
      if (_.isFunction(callback)) {
        callback()
      }
    }
  }

  initIsLoggedChecking () {
    // Check if user has been logged in
    this.loggedInInterval = setInterval(() => {
      chrome.runtime.sendMessage({scope: 'hypothesis', cmd: 'getToken'}, (token) => {
        if (!_.isNull(token)) {
          // Reload the web page
          window.location.reload()
        }
      })
    }, checkHypothesisLoggedInWhenPromptInSeconds * 1000)
  }

  renderGroupsContainer (callback) {
    // Display group selector and purposes selector
    $('#purposesWrapper').attr('aria-hidden', 'false')
    // Retrieve groups
    this.retrieveHypothesisGroups((groups) => {
      console.debug(groups)
      let dropdownMenu = document.querySelector('#groupSelector')
      dropdownMenu.innerHTML = '' // Remove all groups
      this.user.groups.forEach(group => {
        let groupSelectorItem = document.createElement('option')
        groupSelectorItem.dataset.groupId = group.id
        groupSelectorItem.innerText = group.name
        groupSelectorItem.className = 'dropdown-item'
        dropdownMenu.appendChild(groupSelectorItem)
      })
      // Set select option
      $('#groupSelector').find('option[data-group-id="' + this.currentGroup.id + '"]').prop('selected', 'selected')
      // Set event handler for group change
      this.setEventForGroupSelectChange()
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  retrieveHypothesisGroups (callback) {
    window.abwa.hypothesisClientManager.hypothesisClient.getUserProfile((err, profile) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        this.user = profile
        if (_.isFunction(callback)) {
          callback(null, profile.groups)
        }
      }
    })
  }
    
  setEventForGroupSelectChange () {
    let menu = document.querySelector('#groupSelector')
    $(menu).change(() => {
      let selectedGroup = $('#groupSelector').find('option:selected').get(0)
      this.updateCurrentGroupHandler(selectedGroup.dataset.groupId)
    })
  }
    
  updateCurrentGroupHandler (groupId) {
    this.currentGroup = _.find(this.user.groups, (group) => { return groupId === group.id })
    ChromeStorage.setData(selectedGroupNamespace, {data: JSON.stringify(this.currentGroup)}, ChromeStorage.local, () => {
      console.debug('Group updated. Name: %s id: %s', this.currentGroup.name, this.currentGroup.id)
      // Dispatch event
      LanguageUtils.dispatchCustomEvent(GroupSelector.eventGroupChange, {
        group: this.currentGroup,
        time: new Date()
      })
    })
  }
  //PVSCL:ELSECOND
  checkIsLoggedIn (callback) {
    let sidebarURL = chrome.extension.getURL('pages/sidebar/groupSelection.html')
    $.get(sidebarURL, (html) => {
      // Append sidebar to content
      $('#abwaSidebarContainer').append($.parseHTML(html))
      if (!window.abwa.hypothesisClientManager.isLoggedIn()) {
        // Display login/sign up form
        $('#notLoggedInGroupContainer').attr('aria-hidden', 'false')
        // Hide group container
        $('#loggedInGroupContainer').attr('aria-hidden', 'true')
        // Hide purposes wrapper
        $('#purposesWrapper').attr('aria-hidden', 'true')
        // Start listening to when is logged in continuously
        chrome.runtime.sendMessage({scope: 'hypothesis', cmd: 'startListeningLogin'})
        // Open the sidebar to notify user that needs to log in
        window.abwa.sidebar.openSidebar()
        if (_.isFunction(callback)) {
          callback(new Error('Is not logged in'))
        }
      } else {
        if (_.isFunction(callback)) {
          callback()
        }
      }
    })
  }

  retrieveHypothesisGroups (callback) {
    window.abwa.hypothesisClientManager.hypothesisClient.getListOfGroups({}, (err, groups) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        this.groups = groups
        if (_.isFunction(callback)) {
          callback(null, groups)
        }
      }
    })
  }

  retrieveUserProfile (callback) {
    window.abwa.hypothesisClientManager.hypothesisClient.getUserProfile((err, profile) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        this.user = profile
        if (_.isFunction(callback)) {
          callback(null, profile.groups)
        }
      }
    })
  }
  //PVSCL:ENDCOND

  destroy (callback) {
    //PVSCL:IFCOND(GroupSelector)
    // Destroy intervals
    if (this.loggedInInterval) {
      clearInterval(this.loggedInInterval)
    }
    //PVSCL:ENDCOND
    if (_.isFunction(callback)) {
      callback()
    }
  }
}

GroupSelector.eventGroupChange = 'hypothesisGroupChanged'

module.exports = GroupSelector