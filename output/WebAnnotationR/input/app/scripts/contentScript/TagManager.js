const _ = require('lodash')
const $ = require('jquery')
const jsYaml = require('js-yaml')
const ModeManager = require('./ModeManager')
const LanguageUtils = require('../utils/LanguageUtils')
const ColorUtils = require('../utils/ColorUtils')
//
const Events = require('./Events')
const Tag = require('./Tag')
const TagGroup = require('./TagGroup')
const Alerts = require('../utils/Alerts')
//
//
const DefaultHighlighterGenerator = require('../specific/DefaultHighlighterGenerator')
const DefaultCriterias = require('../specific/DefaultCriterias')
//

class TagManager {
  constructor (namespace, config) {
    this.model = {
      documentAnnotations: [],
      groupAnnotations: [],
      namespace: namespace,
      config: config
    }
    this.currentTags = []
    //
    this.currentIndexTags = []
    //
    this.events = {}
  }
  init (callback) {
    console.debug('Initializing TagManager')
    this.initTagsStructure(() => {
      this.initEventHandlers(() => {
        //
        // Show tags container for current mode
    	//
        // Initialize all tags in each of the sidebar modes
        //
        this.initAllTags(() => {
          //
          console.debug('Initialized TagManager')
          if (_.isFunction(callback)) {
            callback()
          }
        })
      })
    })
  }
  //
  reloadTags (callback) {
    // Remove tags buttons for each container (evidencing, viewing)
    _.map(window.abwa.tagManager.tagsContainer).forEach((container) => { container.innerHTML = '' })
    // Init tags again
    this.initAllTags(() => {
        LanguageUtils.dispatchCustomEvent(Events.tagsUpdated, {tags: this.currentTags})
        if (_.isFunction(callback)) {
          callback()
        }
    })
  }
  //
  getGroupAnnotations (callback) {
    window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
      //
      url: window.abwa.groupSelector.currentGroup.links.html,
      //
      order: 'desc'
    }, (err, annotations) => {
      if (err) {
        Alerts.errorAlert({text: 'Unable to construct the highlighter. Please reload webpage and try it again.'})
      } else {
        // Retrieve tags which has the namespace
        annotations = _.filter(annotations, (annotation) => {
          return this.hasANamespace(annotation, this.model.namespace)
        })
        //
        //
        if (_.isFunction(callback)) {
          callback(annotations)
        }
      }
    })
  }

  
  getTagsList () {
    if (this.currentTags.length > 0) {
      if (LanguageUtils.isInstanceOf(this.currentTags[0], Tag)) {
        return this.currentTags
      } else if (LanguageUtils.isInstanceOf(this.currentTags[0], TagGroup)) {
        let tags = []
        for (let i = 0; i < this.currentTags.length; i++) {
          tags = tags.concat(this.currentTags[i].tags)
        }
        return tags
      }
    } else {
      return [] // No tags for current group
    }
  }
  //

  initAllTags (callback) {
    //
    this.getGroupAnnotations((annotations) => {
      // Check if there are tags in the group or it is needed to create the default ones
      let promise = Promise.resolve(annotations) // TODO Check if it is okay
      if (annotations.length === 0) {
        promise = new Promise((resolve) => {
          if (!Alerts.isVisible()) {
            Alerts.loadingAlert({title: 'Configuration in progress', text: 'We are configuring everything to start reviewing.', position: Alerts.position.center})
          }
          DefaultHighlighterGenerator.createDefaultAnnotations(window.abwa.groupSelector.currentGroup, (err, annotations) => {
            if (err) {
              Alerts.errorAlert({text: 'There was an error when configuring Review&Go highlighter'})
            } else {
              Alerts.closeAlert()
              resolve(annotations)
            }
          })
        })
      }
    //
      //
      promise.then((annotations) => {
      //
        // Add to model
        this.model.groupAnnotations = annotations
        //
        // Create tags based on annotations
        this.currentTags = this.createTagsBasedOnAnnotations()
        //
        //
        this.createTagsButtonsForEvidencing()
        //
        //
        //
        if (_.isFunction(callback)) {
          callback()
        }
      })
    //
    })
    //
  }

  hasANamespace (annotation, namespace) {
    return _.findIndex(annotation.tags, (annotationTag) => {
      return _.startsWith(annotationTag.toLowerCase(), (namespace + ':').toLowerCase())
    }) !== -1
  }

  hasATag (annotation, tag) {
    return _.findIndex(annotation.tags, (annotationTag) => {
      return _.startsWith(annotationTag.toLowerCase(), tag.toLowerCase())
    }) !== -1
  }

  createTagsBasedOnAnnotations () {
	  //
	  let tagGroupsAnnotations = {}
    for (let i = 0; i < this.model.groupAnnotations.length; i++) {
      let groupTag = this.retrieveTagNameByPrefix(this.model.groupAnnotations[i].tags, (this.model.namespace + ':' + this.model.config.grouped.group))
      if (groupTag) {
        tagGroupsAnnotations[groupTag] = new TagGroup({name: groupTag, namespace: this.model.namespace, group: this.model.config.grouped.group, options: jsYaml.load(this.model.groupAnnotations[i].text) /**/ ,annotation: this.model.groupAnnotations[i] /**/})
      }
    }
    //
    let groups = _.map(_.uniqBy(DefaultCriterias.criteria, (criteria) => { return criteria.group }), 'group')
    let listOfOtherTags = _.filter(_.values(tagGroupsAnnotations), (tagGroup) => { return tagGroup.config.options.group === 'Other' })
    let colorList = ColorUtils.getDifferentColors(groups.length - 1 + listOfOtherTags.length)
    let colorsGroup = colorList.slice(0, groups.length - 1)
    let colorsOthers = colorList.slice(groups.length - 1)
    let colors = {}
    // Set colors for each group
    let array = _.toArray(tagGroupsAnnotations)
    for (let i = 0; i < array.length; i++) {
      let tagGroup = tagGroupsAnnotations[array[i].config.name]
      let color
      if (tagGroup.config.options.group === 'Other') { // One color for each tag element with group Other
        color = colorsOthers[_.findIndex(listOfOtherTags, (otherTagGroup) => { return otherTagGroup.config.name === tagGroup.config.name })]
        colors[tagGroup.config.name] = color
      } else {
        color = colorsGroup[_.findIndex(groups, (groupName) => { return groupName === tagGroup.config.options.group })]
        colors[tagGroup.config.name] = color
      }
      tagGroup.config.color = color
    }
    //
	//
	for (let i = 0; i < this.model.groupAnnotations.length; i++) {
	  let tagAnnotation = this.model.groupAnnotations[i]
	  let tagName = this.retrieveTagNameByPrefix(this.model.groupAnnotations[i].tags, (this.model.namespace + ':' + this.model.config.grouped.subgroup))
	  let groupBelongedTo = this.retrieveTagNameByPrefix(this.model.groupAnnotations[i].tags, (this.model.namespace + ':' + this.model.config.grouped.relation))
	  if (tagName && groupBelongedTo) {
	    if (_.isArray(tagGroupsAnnotations[groupBelongedTo].tags)) {
	      // Load options from annotation text body
	      let options = jsYaml.load(tagAnnotation.text)
	      tagGroupsAnnotations[groupBelongedTo].tags.push(new Tag({
	        name: tagName,
	        namespace: this.model.namespace,
	        options: options || {},
	        //
	        annotation: tagAnnotation,
	        //
	        tags: [
	          this.model.namespace + ':' + this.model.config.grouped.relation + ':' + groupBelongedTo,
	          this.model.namespace + ':' + this.model.config.grouped.subgroup + ':' + tagName]
	      }, tagGroupsAnnotations[groupBelongedTo]))
	      this.model.currentTags = tagGroupsAnnotations
	    }
	  }
	}
    tagGroupsAnnotations = _.map(tagGroupsAnnotations, (tagGroup) => {
      //
      // TODO Check all elements, not only tags[0]
      if (_.isArray(tagGroup.tags) && _.has(tagGroup.tags[0], 'name') && _.isNaN(_.parseInt(tagGroup.tags[0].name))) {
        tagGroup.tags = _.sortBy(tagGroup.tags, 'name')
      } else {
        tagGroup.tags = _.sortBy(tagGroup.tags, (tag) => _.parseInt(tag.name))
      }
      //
      return tagGroup
    })
    
    // Set color for each code
    tagGroupsAnnotations = _.map(tagGroupsAnnotations, (tagGroup) => {
      if (tagGroup.tags.length > 0) {
        tagGroup.tags = _.map(tagGroup.tags, (tag, index) => {
          // Calculate the color maximum value (if dark color, the maximum will be 0.6, for light colors 0.9
          let max = ColorUtils.isDark(colors[tagGroup.config.name]) ? 0.6 : 0.8
          let color = ColorUtils.setAlphaToColor(colors[tagGroup.config.name], 0.2 + index / tagGroup.tags.length * max)
          tag.options.color = color
          tag.color = color
          return tag
        })
      }
      return tagGroup
    })
    //
    // Hash to array
    return _.sortBy(tagGroupsAnnotations, 'config.name')
  }
  
  //
  
  destroy () {
	// Remove event listeners
	let events = _.values(this.events)
	for (let i = 0; i < events.length; i++) {
	  events[i].element.removeEventListener(events[i].event, events[i].handler)
	}
	// Remove tags wrapper
	$('#tagsWrapper').remove()
  }

  retrieveTagNameByPrefix (annotationTags, prefix) {
    for (let i = 0; i < annotationTags.length; i++) {
      if (_.startsWith(annotationTags[i].toLowerCase(), prefix.toLowerCase())) {
        return _.replace(annotationTags[i], prefix + ':', '')
      }
    }
    return null
  }
  
  //
  collapseExpandGroupedButtonsHandler (event) {
    let tagGroup = event.target.parentElement
    if (tagGroup.getAttribute('aria-expanded') === 'true') {
      tagGroup.setAttribute('aria-expanded', 'false')
    } else {
      tagGroup.setAttribute('aria-expanded', 'true')
    }
  }
  //
  
  createTagButtons (callback) {
	//
	let groups = _.map(_.uniqBy(DefaultCriterias.criteria, (criteria) => { return criteria.group }), 'group')
    for (let i = 0; i < groups.length; i++) {
      let group = groups[i]
      this.tagsContainer.evidencing.append(TagManager.createGroupedButtons({name: group, groupHandler: this.collapseExpandGroupedButtonsHandler}))
    }
    // Create the group Other
    // Not required to create this group because "Typos" is a default code from Other category, otherwise discomment this two lines
    /* let groupedButtons = TagManager.createGroupedButtons({name: 'Other', groupHandler: this.collapseExpandGroupedButtonsHandler})
    groupedButtons.id = 'tagGroupOther'
    this.tagsContainer.evidencing.append(groupedButtons) */
    // Create the default groups for annotations
    // Insert buttons in each of the groups
    let arrayOfTagGroups = _.values(this.model.currentTags)
    for (let i = 0; i < arrayOfTagGroups.length; i++) {
      let tagGroup = arrayOfTagGroups[i]
      let button = TagManager.createButton({
        name: tagGroup.config.name,
        color: ColorUtils.setAlphaToColor(tagGroup.config.color, 0.3),
        description: tagGroup.config.options.description,
        handler: (event) => {
          let tags = [
            this.model.namespace + ':' + this.model.config.grouped.relation + ':' + tagGroup.config.name
          ]
          LanguageUtils.dispatchCustomEvent(Events.annotate, {tags: tags, chosen: event.target.dataset.chosen})
        }
      })
      // Insert in its corresponding group container
      this.tagsContainer.evidencing.querySelector('[title="' + tagGroup.config.options.group + '"]').nextElementSibling.append(button)
    }
	//
  }
  
  //
  
  createTagsButtonsForEvidencing () {
	  //
    let groups = _.map(_.uniqBy(DefaultCriterias.criteria, (criteria) => { return criteria.group }), 'group')
    for (let i = 0; i < groups.length; i++) {
      let group = groups[i]
      this.tagsContainer.evidencing.append(TagManager.createGroupedButtons({name: group, groupHandler: this.collapseExpandGroupedButtonsHandler}))
    }
    // Create the group Other
    // Not required to create this group because "Typos" is a default code from Other category, otherwise discomment this two lines
    /* let groupedButtons = TagManager.createGroupedButtons({name: 'Other', groupHandler: this.collapseExpandGroupedButtonsHandler})
    groupedButtons.id = 'tagGroupOther'
    this.tagsContainer.evidencing.append(groupedButtons) */
    // Create the default groups for annotations
    // Insert buttons in each of the groups
    let arrayOfTagGroups = _.values(this.model.currentTags)
    for (let i = 0; i < arrayOfTagGroups.length; i++) {
      let tagGroup = arrayOfTagGroups[i]
      let button = TagManager.createButton({
        name: tagGroup.config.name,
        color: ColorUtils.setAlphaToColor(tagGroup.config.color, 0.3),
        description: tagGroup.config.options.description,
        handler: (event) => {
          let tags = [
            this.model.namespace + ':' + this.model.config.grouped.relation + ':' + tagGroup.config.name
          ]
          LanguageUtils.dispatchCustomEvent(Events.annotate, {tags: tags, chosen: event.target.dataset.chosen})
        }
      })
      // Insert in its corresponding group container
      this.tagsContainer.evidencing.querySelector('[title="' + tagGroup.config.options.group + '"]').nextElementSibling.append(button)
    }
    //
  }
  
  //
  
  //
  static createButton ({name, color = 'white', description, handler, role}) {
    let tagButtonTemplate = document.querySelector('#tagButtonTemplate')
    let tagButton = $(tagButtonTemplate.content.firstElementChild).clone().get(0)
    tagButton.innerText = name
    if (description) {
      tagButton.title = name + ': ' + description
    } else {
      tagButton.title = name
    }
    tagButton.dataset.mark = name
    tagButton.setAttribute('role', role || 'annotation')
    if (color) {
      $(tagButton).css('background-color', color)
      tagButton.dataset.baseColor = color
    }
    // Set handler for button
    tagButton.addEventListener('click', handler)
    // Tag button background color change
    // TODO It should be better to set it as a CSS property, but currently there is not an option for that
    //
    tagButton.addEventListener('mouseenter', () => {
    	tagButton.style.backgroundColor = ColorUtils.setAlphaToColor(ColorUtils.colorFromString(tagButton.dataset.baseColor), 0.7)
    })
    tagButton.addEventListener('mouseleave', () => {
      if (tagButton.dataset.chosen === 'true') {
        tagButton.style.backgroundColor = ColorUtils.setAlphaToColor(ColorUtils.colorFromString(tagButton.dataset.baseColor), 0.6)
      } else {
        tagButton.style.backgroundColor = tagButton.dataset.baseColor
      }
    })
    //
    return tagButton
  }
  
  static createGroupedButtons ({name, color = 'white', elements, groupHandler, buttonHandler}) {
    // Create the container
    let tagGroupTemplate = document.querySelector('#tagGroupTemplate')
    let tagGroup = $(tagGroupTemplate.content.firstElementChild).clone().get(0)
    //
    let tagButtonContainer = $(tagGroup).find('.tagButtonContainer')
    let groupNameSpan = tagGroup.querySelector('.groupName')
    groupNameSpan.innerText = name
    groupNameSpan.title = name
    //
    // Create event handler for tag group
    groupNameSpan.addEventListener('click', groupHandler)
    // Create buttons and add to the container
    if (/**/ _.isArray(elements) && /**/ elements.length > 0) { // Only create group containers for groups which have elements
      for (let i = 0; i < elements.length; i++) {
        let element = elements[i]
        //
        let button = TagManager.createButton({
        //
          name: element.name,
          color: element.getColor(),
          description: (element.options.description || null),
          handler: buttonHandler,
          role: 'marking'
        })
        tagButtonContainer.append(button)
      }
    }
    return tagGroup
  }
  //
  
  initEventHandlers (callback) {
	//
	//
	// For mode change
    this.events.modeChange = {
      element: document,
      event: Events.modeChanged,
      handler: (event) => { this.modeChangeHandler(event) }
    }
    this.events.modeChange.element.addEventListener(this.events.modeChange.event, this.events.modeChange.handler, false)
	//
	//
	// For annotation event, reload sidebar with elements chosen and not chosen ones
    this.events.annotationCreated = {
      element: document,
      event: Events.annotationCreated,
      handler: (event) => { this.reloadTagsChosen() }
    }
    this.events.annotationCreated.element.addEventListener(this.events.annotationCreated.event, this.events.annotationCreated.handler, false)
	// For delete event, reload sidebar with elements chosen and not chosen ones
    this.events.annotationDeleted = {
      element: document,
      event: Events.annotationDeleted,
      handler: (event) => { this.reloadTagsChosen() }
    }
    this.events.annotationDeleted.element.addEventListener(this.events.annotationDeleted.event, this.events.annotationDeleted.handler, false)
    // When annotations are reloaded
    this.events.updatedAllAnnotations = {
      element: document,
      event: Events.updatedAllAnnotations,
      handler: (event) => { this.reloadTagsChosen() }
    }
    this.events.updatedAllAnnotations.element.addEventListener(this.events.updatedAllAnnotations.event, this.events.updatedAllAnnotations.handler, false)
    //
    if (_.isFunction(callback)) {
      callback()
    }
  }
  
  //
  reloadTagsChosen () {
    // Uncheck all the tags
    let tagButtons = document.querySelectorAll('.tagButton')
    for (let i = 0; i < tagButtons.length; i++) {
      let tagButton = tagButtons[i]
      tagButton.dataset.chosen = 'false'
      tagButton.style.background = ColorUtils.setAlphaToColor(ColorUtils.colorFromString(tagButton.style.backgroundColor), 0.3)
    }
    // Retrieve annotated tags
    if (window.abwa.contentAnnotator) {
      let annotations = window.abwa.contentAnnotator.allAnnotations
      let annotatedTagGroups = []
      for (let i = 0; i < annotations.length; i++) {
        annotatedTagGroups.push(this.getGroupFromAnnotation(annotations[i]))
      }
      annotatedTagGroups = _.uniq(annotatedTagGroups)
      // Mark as chosen annotated tags
      for (let i = 0; i < annotatedTagGroups.length; i++) {
        let tagGroup = annotatedTagGroups[i]
        let tagButton = this.tagsContainer.evidencing.querySelector('.tagButton[data-mark="' + tagGroup.config.name + '"]')
        tagButton.dataset.chosen = 'true'
        // Change to a darker color
        tagButton.style.background = ColorUtils.setAlphaToColor(ColorUtils.colorFromString(tagButton.style.backgroundColor), 0.6)
      }
    }
  }
  //
    
  //
  createUpdatedCurrentAnnotationsEventHandler () {
    return (event) => {
      // Retrieve current annotations
      let currentAnnotations = event.detail.currentAnnotations
      // Update index tags menu
      this.updateIndexTags(currentAnnotations)
    }
  }

  updateIndexTags (currentAnnotations) {
    let tagsIndexContainer = document.querySelector('#tagsIndex')
    tagsIndexContainer.innerHTML = ''
    // Retrieve group annotations
    let groupAnnotations = this.model.groupAnnotations
    let groupTags = {}
    for (let i = 0; i < groupAnnotations.length; i++) {
      let groupTag = this.retrieveTagNameByPrefix(groupAnnotations[i].tags, (this.model.namespace + ':' + this.model.config.grouped.group))
      if (groupTag) {
        groupTags[groupTag] = new TagGroup({name: groupTag, namespace: this.model.namespace, group: this.model.config.grouped.group})
      }
    }
    // Retrieve tags of the namespace
    let documentAnnotations = _.filter(currentAnnotations, (annotation) => {
      return this.hasANamespace(annotation, this.model.namespace)
    })
    // Group active subgroups by groups
    for (let i = 0; i < documentAnnotations.length; i++) {
      let annotationGroupData = this.getGroupAndSubgroup(documentAnnotations[i])
      // If not already subgroup, define it
      if (!_.find(groupTags[annotationGroupData.group].tags, (tag) => { return tag.name === annotationGroupData.subgroup })) {
        // Create tag and add to its group
        // If has subgroup
        if (annotationGroupData.subgroup) {
          let tagName = annotationGroupData.subgroup
          let tagGroup = _.find(window.abwa.tagManager.model.currentTags, (groupTag) => { return groupTag.config.name === annotationGroupData.group })
          let tag = _.find(tagGroup.tags, (tag) => { return tag.name === annotationGroupData.subgroup })
          if (_.has(tag, 'color')) {
            groupTags[annotationGroupData.group].tags.push(new Tag({
              name: tagName,
              namespace: this.model.namespace,
              options: {color: tag.color},
              tags: [
                this.model.namespace + ':' + this.model.config.grouped.relation + ':' + annotationGroupData.group,
                this.model.namespace + ':' + this.model.config.grouped.subgroup + ':' + annotationGroupData.subgroup
              ]
            }))
          } else {
            console.error('Error parsing tags in sidebar') // TODO Show user
          }
        } else { // If doesn't have subgroup (free category)
          let tagName = annotationGroupData.group
          let color = _.find(window.abwa.tagManager.getTagsList(), (tag) => { return tag.name === tagName }).color
          if (groupTags[annotationGroupData.group].tags.length === 0) {
            groupTags[annotationGroupData.group].tags.push(new Tag({
              name: tagName,
              namespace: this.model.namespace,
              options: {color: color},
              tags: [
                this.model.namespace + ':' + this.model.config.grouped.group + ':' + tagName
              ]
            }))
          }
        }
      }
    }
    // Order code for each group
    groupTags = _.map(groupTags, (tagGroup) => { tagGroup.tags = _.sortBy(tagGroup.tags, 'name'); return tagGroup })
    // Order the groups
    this.currentIndexTags = _.sortBy(groupTags, 'config.name')
    // Generate tag groups and buttons
    this.createIndexTagsButtons()
  }
  
  createIndexTagsButtons (callback) {
    // If it is a non empty array, add buttons
    if (this.currentIndexTags.length > 0) {
      if (LanguageUtils.isInstanceOf(this.currentIndexTags[0], Tag)) {
        for (let i = 0; i < this.currentIndexTags.length; i++) {
          // Append each element
          let tagButton = Tag.currentIndexTags[i].createButton()
          tagButton.setAttribute('role', Tag.roles.index) // Set index rol to tag
          this.tagsContainer.index.append(tagButton)
        }
      } else if (LanguageUtils.isInstanceOf(this.currentIndexTags[0], TagGroup)) {
        for (let i = 0; i < this.currentIndexTags.length; i++) {
          let tagGroupElement = this.currentIndexTags[i].createPanel(true) // Index tag buttons panel
          if (tagGroupElement) {
            this.tagsContainer.index.append(tagGroupElement)
          }
        }
      }
    }
    if (_.isFunction(callback)) {
      callback()
    }
  }
  //
  
  modeChangeHandler (event) {
	//
    if (event.detail.mode === ModeManager.modes.evidencing) {
        this.showEvidencingTagsContainer()
    }
	//
  }
  
  showTagsContainerForMode (mode) {
    if (mode === ModeManager.modes.evidencing) {
      this.showEvidencingTagsContainer()
    } else if (mode === ModeManager.modes.mark) {
      this.showMarkingTagsContainer()
    } else if (mode === ModeManager.modes.view) {
      this.showViewingTagsContainer()
    }
  }
  //
  showEvidencingTagsContainer () {
    $(this.tagsContainer.viewing).attr('aria-hidden', 'true')
    $(this.tagsContainer.marking).attr('aria-hidden', 'true')
    $(this.tagsContainer.evidencing).attr('aria-hidden', 'false')
  }
  //
  
  //
  reorderNoGroupedTagContainer (order, container) {
    // Reorder marking container
    for (let i = order.length - 1; i >= 0; i--) {
      let criteria = order[i]
      let tagButton = _.find(container.querySelectorAll('.tagButton'), (elem) => { return elem.title === criteria })
      let elem = $(tagButton).detach()
      $(container).prepend(elem)
    }
  }
  //
  //
  showViewingTagsContainer () {
    $(this.tagsContainer.viewing).attr('aria-hidden', 'false')
    $(this.tagsContainer.marking).attr('aria-hidden', 'true')
    $(this.tagsContainer.evidencing).attr('aria-hidden', 'true')
  }
  //
  
  //
  reorderGroupedTagContainer (order, container) {
    // Reorder marking container
    for (let i = order.length - 1; i >= 0; i--) {
      let criteria = order[i]
      let tagGroup = _.find(container.querySelectorAll('.tagGroup'), (elem) => { return elem.children[0].title === criteria })
      let elem = $(tagGroup).detach()
      $(container).prepend(elem)
    }
  }
  getFilteringTagList () {
    return _.map(this.currentTags, (tagGroup) => {
      return this.getTagFromGroup(tagGroup)
    })
  }

  getTagFromGroup (tagGroup) {
    return this.model.namespace + ':' + this.model.config.grouped.relation + ':' + tagGroup.config.name
  }

  findAnnotationTagInstance (annotation) {
    let groupTag = this.getGroupFromAnnotation(annotation)
    if (/**/ _.isObject(groupTag) /**/) {
      // Check if has code defined, because other tags can be presented (like exam:studentId:X)
      if (this.hasCodeAnnotation(annotation)) {
        return this.getCodeFromAnnotation(annotation, groupTag)
      } else {
        return groupTag
      }
    } else {
      return groupTag
    }
  }

  getGroupFromAnnotation (annotation) {
    let tags = annotation.tags
    let criteriaTag = _.find(tags, (tag) => {
      return tag.includes(/**/ 'review:isCriteriaOf:' /**/)
    }).replace(/**/ 'review:isCriteriaOf:' /**/, '')
    return _.find(window.abwa.tagManager.currentTags, (tagGroupInstance) => {
      return criteriaName === tagGroupInstance.config.name
    })
  }

  getCodeFromAnnotation (annotation, groupTag) {
    let markTag = _.find(annotation.tags, (tag) => {
      return tag.includes(/**/ 'review:level:' /**/)
    }).replace(/**/'review:level:' /**/, '')
    return _.find(groupTag.tags, (tagInstance) => {
      //
      return markTag.includes(tagInstance.name)
      //
    })
  }

  hasCodeAnnotation (annotation) {
    return _.some(annotation.tags, (tag) => {
      return tag.includes(/**/ 'review:level:' /**/)
    })
  }
  /**/
  initTagsStructure (callback) {
    //
    let tagWrapperUrl = chrome.extension.getURL('pages/sidebar/tagWrapper.html')
    $.get(tagWrapperUrl, (html) => {
      $('#abwaSidebarContainer').append($.parseHTML(html))
      this.tagsContainer = {evidencing: document.querySelector('#tagsEvidencing')}
      if (_.isFunction(callback)) {
        callback()
      }
    })
    //
  }
}
  
module.exports = TagManager