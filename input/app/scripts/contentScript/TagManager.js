const _ = require('lodash')
const $ = require('jquery')
const jsYaml = require('js-yaml')
const ModeManager = require('./ModeManager')
const LanguageUtils = require('../utils/LanguageUtils')
const ColorUtils = require('../utils/ColorUtils')
//PVSCL:IFCOND(Marks)
const AnnotationUtils = require('../utils/AnnotationUtils')
//PVSCL:ENDCOND
const Events = require('./Events')
const Tag = require('./Tag')
const TagGroup = require('./TagGroup')
//const Alerts = require('../utils/Alerts')
//PVSCL:IFCOND(Student)
const CircularJSON = require('circular-json-es6')
//PVSCL:ENDCOND
//PVSCL:IFCOND(DefaultCriterias)
const DefaultHighlighterGenerator = require('../specific/DefaultHighlighterGenerator')
const DefaultCriterias = require('../specific/DefaultCriterias')
//PVSCL:ENDCOND

class TagManager {
  constructor (namespace, config) {
    this.model = {
      documentAnnotations: [],
      groupAnnotations: [],
      namespace: namespace,
      config: config
    }
    this.currentTags = []
    //PVSCL:IFCOND(Index)
    this.currentIndexTags = []
    //PVSCL:ENDCOND
    this.events = {}
  }
  init (callback) {
    console.debug('Initializing TagManager')
    this.initTagsStructure(() => {
      this.initEventHandlers(() => {
        //PVSCL:IFCOND((MarkingMode AND EvidencingMode) OR ReviewMode)
        // Show tags container for current mode
    	//PVSCL:IFCOND(NOT(ReviewMode))
        this.showTagsContainerForMode(window.abwa.modeManager.mode)
        //PVSCL:ENDCOND
        // Initialize all tags in each of the sidebar modes
        //PVSCL:ENDCOND
        this.initAllTags(() => {
          //PVSCL:IFCOND(HighlightMode AND IndexMode)
          if (window.abwa.modeManager.mode === ModeManager.modes.highlight) {
            this.showAllTagsContainer()
          } else {
            this.showIndexTagsContainer()
          }
          //PVSCL:ENDCOND
          console.debug('Initialized TagManager')
          if (_.isFunction(callback)) {
            callback()
          }
        })
      })
    })
  }
  //PVSCL:IFCOND(AllDeleter)
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
  //PVSCL:ENDCOND
  getGroupAnnotations (callback) {
    window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
      //PVSCL:IFCOND(GroupSelector)
      url: window.abwa.groupSelector.currentGroup.url,
      //PVSCL:ELSECOND
      url: window.abwa.groupSelector.currentGroup.links.html,
      //PVSCL:ENDCOND
      order: 'desc'
    }, (err, annotations) => {
      if (err) {
        //Alerts.errorAlert({text: 'Unable to construct the highlighter. Please reload webpage and try it again.'})
      } else {
        // Retrieve tags which has the namespace
        annotations = _.filter(annotations, (annotation) => {
          return this.hasANamespace(annotation, this.model.namespace)
        })
        //PVSCL:IFCOND(Spreadsheet)
        // Remove slr:spreadsheet annotation ONLY for SLR case
        annotations = _.filter(annotations, (annotation) => {
          return !this.hasATag(annotation, 'slr:spreadsheet')
        })
        //PVSCL:ENDCOND
        //PVSCL:IFCOND(Moodle)
        // Remove tags which are not for the current assignment
        let cmid = window.abwa.contentTypeManager.fileMetadata.cmid
        annotations = _.filter(annotations, (annotation) => {
          return this.hasATag(annotation, 'exam:cmid:' + cmid)
        })
        //PVSCL:ENDCOND
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
  //PVSCL:IFCOND(NOT(DefaultCriterias))
  static retrieveTagForAnnotation (annotation, tagList) {
    for (let i = 0; i < tagList.length; i++) {
      let difference = _.differenceWith(
        tagList[i].tags,
        annotation.tags,
        (tag1, tag2) => {
          return tag1.toLowerCase() === tag2.toLowerCase()
        })
      if (difference.length === 0) {
        return tagList[i]
      }
    }
  }
  //PVSCL:ENDCOND

  initAllTags (callback) {
    //PVSCL:IFCOND(DefaultCriterias)
    this.getGroupAnnotations((annotations) => {
      // Check if there are tags in the group or it is needed to create the default ones
      let promise = Promise.resolve(annotations) // TODO Check if it is okay
      if (annotations.length === 0) {
        promise = new Promise((resolve) => {
          /*if (!Alerts.isVisible()) {
            Alerts.loadingAlert({title: 'Configuration in progress', text: 'We are configuring everything to start reviewing.', position: Alerts.position.center})
          }*/
          DefaultHighlighterGenerator.createDefaultAnnotations(window.abwa.groupSelector.currentGroup, (err, annotations) => {
            if (err) {
              //Alerts.errorAlert({text: 'There was an error when configuring Review&Go highlighter'})
            } else {
              //Alerts.closeAlert()
              resolve(annotations)
            }
          })
        })
      }
    //PVSCL:ENDCOND
      //PVSCL:IFCOND(DefaultCriterias)
      promise.then((annotations) => {
      //PVSCL:ELSECOND
      this.getGroupAnnotations((annotations) => {
      //PVSCL:ENDCOND
        // Add to model
        this.model.groupAnnotations = annotations
        //PVSCL:IFCOND(Spreadsheet)
        // If annotations are grouped
        if (!_.isEmpty(this.model.config.grouped)) {
          this.currentTags = this.createTagsBasedOnAnnotationsGrouped(annotations, this.model.config.grouped)
        } else {
          // Create tags based on annotations
          this.currentTags = this.createTagsBasedOnAnnotations(annotations)
        }
        //PVSCL:ELSECOND
        // Create tags based on annotations
        this.currentTags = this.createTagsBasedOnAnnotations()
        //PVSCL:ENDCOND
        //PVSCL:IFCOND(EvidencingMode OR ReviewMode)
        this.createTagsButtonsForEvidencing()
        //PVSCL:ENDCOND
        //PVSCL:IFCOND(MarkingMode)
        this.createTagsButtonsForMarking()
        //PVSCL:ENDCOND
        //PVSCL:IFCOND(Student)
        this.createTagsButtonsForViewing()
        //PVSCL:ELSEIFCOND(Spreadsheet)
        this.createTagButtons()
        //PVSCL:ENDCOND
        if (_.isFunction(callback)) {
          callback()
        }
      })
    //PVSCL:IFCOND(DefaultCriterias)
    })
    //PVSCL:ENDCOND
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
	  //PVSCL:IFCOND(Spreadsheet)
	  let tags = []
    for (let i = 0; i < this.model.groupAnnotations.length; i++) {
      let tagAnnotation = this.model.groupAnnotations[i]
      let tagName = tagAnnotation.tags[0].substr(this.model.namespace.length + 1) // <namespace>:
      tags.push(new Tag({name: tagName, namespace: this.model.namespace, options: jsYaml.load(tagAnnotation.text)}))
    }
    this.model.currentTags = tags
    return tags
	  //PVSCL:ELSECOND
	  let tagGroupsAnnotations = {}
    for (let i = 0; i < this.model.groupAnnotations.length; i++) {
      let groupTag = this.retrieveTagNameByPrefix(this.model.groupAnnotations[i].tags, (this.model.namespace + ':' + this.model.config.grouped.group))
      if (groupTag) {
        tagGroupsAnnotations[groupTag] = new TagGroup({name: groupTag, namespace: this.model.namespace, group: this.model.config.grouped.group, options: jsYaml.load(this.model.groupAnnotations[i].text) /*PVSCL:IFCOND(DefaultCriterias)*/ ,annotation: this.model.groupAnnotations[i] /*PVSCL:ENDCOND*/})
      }
    }
    //PVSCL:IFCOND(DefaultCriterias)
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
    //PVSCL:ELSECOND
    let groups = _.sortBy(_.keys(tagGroupsAnnotations))
    let colorList = ColorUtils.getDifferentColors(groups.length)
    for (let i = 0; i < groups.length; i++) {
      colors[groups[i]] = colorList[i]
      tagGroupsAnnotations[groups[i]].config.color = colorList[i]
    }
    //PVSCL:ENDCOND
	//PVSCL:ENDCOND
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
	        //PVSCL:IFCOND(DefaultCriterias)
	        annotation: tagAnnotation,
	        //PVSCL:ENDCOND
	        tags: [
	          this.model.namespace + ':' + this.model.config.grouped.relation + ':' + groupBelongedTo,
	          this.model.namespace + ':' + this.model.config.grouped.subgroup + ':' + tagName]
	      }, tagGroupsAnnotations[groupBelongedTo]))
	      this.model.currentTags = tagGroupsAnnotations
	    }
	  }
	}
    tagGroupsAnnotations = _.map(tagGroupsAnnotations, (tagGroup) => {
      //PVSCL:IFCOND(DefaultCriterias)
      // TODO Check all elements, not only tags[0]
      if (_.isArray(tagGroup.tags) && _.has(tagGroup.tags[0], 'name') && _.isNaN(_.parseInt(tagGroup.tags[0].name))) {
        tagGroup.tags = _.sortBy(tagGroup.tags, 'name')
      } else {
        tagGroup.tags = _.sortBy(tagGroup.tags, (tag) => _.parseInt(tag.name))
      }
      //PVSCL:ELSECOND
      // TODO Check all elements, not only tags[0]
      if (_.has(tagGroup.tags[0], 'options.levelId')) {
        tagGroup.tags = _.sortBy(tagGroup.tags, 'options.levelId') // By level id if it is set
      } else if (!_.isNaN(_.parseInt(tagGroup.tags[0].name))) {
        tagGroup.tags = _.sortBy(tagGroup.tags, (tag) => _.parseInt(tag.name)) // Integer order
      } else {
        tagGroup.tags = _.sortBy(tagGroup.tags, 'name') // By string
      }
      //PVSCL:ENDCOND
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
    //PVSCL:IFCOND(NOT(DefaultCriterias))
    // For groups without sub elements
    let emptyGroups = _.filter(tagGroupsAnnotations, (group) => { return group.tags.length === 0 })
    for (let j = 0; j < emptyGroups.length; j++) {
      let options = {color: ColorUtils.setAlphaToColor(colors[emptyGroups[j].config.name], 0.5)}
      let index = _.findIndex(tagGroupsAnnotations, (tagGroup) => { return tagGroup.config.name === emptyGroups[j].config.name })
      if (index >= 0) {
        tagGroupsAnnotations[index].tags.push(new Tag({
          name: emptyGroups[j].config.name,
          namespace: emptyGroups[j].namespace,
          options: options,
          tags: [emptyGroups[j].config.namespace + ':' + emptyGroups[j].config.group + ':' + emptyGroups[j].config.name]
        }))
      }
    }
    //PVSCL:ENDCOND
    // Hash to array
    return _.sortBy(tagGroupsAnnotations, 'config.name')
  }
  
  //PVSCL:IFCOND(Spreadsheet)
  createTagsBasedOnAnnotationsGrouped () {
    let tagGroupsAnnotations = {}
    for (let i = 0; i < this.model.groupAnnotations.length; i++) {
      let groupTag = this.retrieveTagNameByPrefix(this.model.groupAnnotations[i].tags, (this.model.namespace + ':' + this.model.config.grouped.group))
      if (groupTag) {
        tagGroupsAnnotations[groupTag] = new TagGroup({name: groupTag, namespace: this.model.namespace, group: this.model.config.grouped.group})
      }
    }
    let groups = _.sortBy(_.keys(tagGroupsAnnotations))
    let colorList = ColorUtils.getDifferentColors(groups.length)
    let colors = {}
    for (let i = 0; i < groups.length; i++) {
      colors[groups[i]] = colorList[i]
    }
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
            tags: [
              this.model.namespace + ':' + this.model.config.grouped.relation + ':' + groupBelongedTo,
              this.model.namespace + ':' + this.model.config.grouped.subgroup + ':' + tagName]
          }))
          this.model.currentTags = tagGroupsAnnotations
        }
      }
    }
    // Reorder the codes by name
    tagGroupsAnnotations = _.map(tagGroupsAnnotations, (tagGroup) => { tagGroup.tags = _.sortBy(tagGroup.tags, 'name'); return tagGroup })
    // Set color for each code
    tagGroupsAnnotations = _.map(tagGroupsAnnotations, (tagGroup) => {
      if (tagGroup.tags.length > 0) {
        tagGroup.tags = _.map(tagGroup.tags, (tag, index) => {
          let color = ColorUtils.setAlphaToColor(colors[tagGroup.config.name], 0.2 + index / tagGroup.tags.length * 0.8)
          tag.options.color = color
          tag.color = color
          return tag
        })
      }
      return tagGroup
    })
    // For groups without sub elements
    let emptyGroups = _.filter(tagGroupsAnnotations, (group) => { return group.tags.length === 0 })
    for (let j = 0; j < emptyGroups.length; j++) {
      let options = {color: ColorUtils.setAlphaToColor(colors[emptyGroups[j].config.name], 0.5)}
      let index = _.findIndex(tagGroupsAnnotations, (tagGroup) => { return tagGroup.config.name === emptyGroups[j].config.name })
      if (index >= 0) {
        tagGroupsAnnotations[index].tags.push(new Tag({
          name: emptyGroups[j].config.name,
          namespace: emptyGroups[j].namespace,
          options: options,
          tags: [emptyGroups[j].config.namespace + ':' + emptyGroups[j].config.group + ':' + emptyGroups[j].config.name]
        }))
      }
    }
    // Hash to array
    return _.sortBy(tagGroupsAnnotations, 'config.name')
  }
  //PVSCL:ENDCOND
  
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
  
  //PVSCL:IFCOND(DefaultCriterias)
  collapseExpandGroupedButtonsHandler (event) {
    let tagGroup = event.target.parentElement
    if (tagGroup.getAttribute('aria-expanded') === 'true') {
      tagGroup.setAttribute('aria-expanded', 'false')
    } else {
      tagGroup.setAttribute('aria-expanded', 'true')
    }
  }
  //PVSCL:ENDCOND
  
  createTagButtons (callback) {
	//PVSCL:IFCOND(DefaultCriterias)
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
	//PVSCL:ELSEIFCOND(Moodle)
	let arrayOfTagGroups = _.values(this.model.currentTags)
    arrayOfTagGroups = _.orderBy(arrayOfTagGroups, 'config.options.criteriaId')
    for (let i = 0; i < arrayOfTagGroups.length; i++) {
      let tagGroup = arrayOfTagGroups[i]
      let button = this.createButton({
        name: tagGroup.config.name,
        color: ColorUtils.setAlphaToColor(tagGroup.config.color, 0.5),
        handler: (event) => {
          // Tags for current button
          let tags = [
            this.model.namespace + ':' + this.model.config.grouped.relation + ':' + tagGroup.config.name,
            'exam:cmid:' + window.abwa.contentTypeManager.fileMetadata.cmid
          ]
          // Check if it is already marked to get current mark
          let mark = window.abwa.specific.assessmentManager.marks[tagGroup.config.name]
          if (!_.isNull(mark.level)) {
            tags.push(this.model.namespace + ':' + this.model.config.grouped.subgroup + ':' + mark.level.name)
          }
          LanguageUtils.dispatchCustomEvent(Events.annotate, {tags: tags})
        }})
      this.tagsContainer.evidencing.append(button)
    }
	//PVSCL:ELSECOND
	// If it is an array is not grouped
    if (this.currentTags.length > 0) {
      if (LanguageUtils.isInstanceOf(this.currentTags[0], Tag)) {
        for (let i = 0; i < this.currentTags.length; i++) {
          // Append each element
          let tagButton = Tag.currentTags[i].createButton()
          this.tagsContainer.annotate.append(tagButton)
        }
      } else if (LanguageUtils.isInstanceOf(this.currentTags[0], TagGroup)) {
        for (let i = 0; i < this.currentTags.length; i++) {
          let tagGroupElement = this.currentTags[i].createPanel()
          if (tagGroupElement) {
            this.tagsContainer.annotate.append(tagGroupElement)
          }
        }
      }
    }
    if (_.isFunction(callback)) {
      callback()
    }
	//PVSCL:ENDCOND
  }
  
  //PVSCL:IFCOND(Marks)
  getCurrentMarkForCriteria (criteriaName) {
    // TODO Get mark from any document for this student, not only in the current document ¿?
    let otherAnnotationSameCriteria = _.find(window.abwa.contentAnnotator.currentAnnotations, (annotation) => {
      let criteria = AnnotationUtils.getTagSubstringFromAnnotation(annotation, 'exam:isCriteriaOf:')
      return criteria === criteriaName
    })
    if (_.isObject(otherAnnotationSameCriteria)) {
      // Get if has mark
      let mark = AnnotationUtils.getTagSubstringFromAnnotation(otherAnnotationSameCriteria, 'exam:mark:')
      if (mark) {
        return mark
      } else {
        return null
      }
    }
  }
  
  createTagsButtonsForMarking () {
    let arrayOfTagGroups = _.values(this.model.currentTags)
    arrayOfTagGroups = _.orderBy(arrayOfTagGroups, 'config.options.criteriaId')
    for (let i = 0; i < arrayOfTagGroups.length; i++) {
      let tagGroup = arrayOfTagGroups[i]
      let panel = this.createGroupedButtons({
        name: tagGroup.config.name,
        color: tagGroup.config.color,
        elements: tagGroup.tags,
        groupHandler: (event) => {
          // Go to annotation with that group tag
          window.abwa.contentAnnotator.goToAnnotationOfTag('exam:isCriteriaOf:' + tagGroup.config.name)
        },
        buttonHandler: (event) => {
          LanguageUtils.dispatchCustomEvent(Events.mark, {criteriaName: tagGroup.config.name, levelName: event.target.dataset.mark})
        }
      })
      this.tagsContainer.marking.append(panel)
    }
  }
  //PVSCL:ENDCOND
  
  createTagsButtonsForEvidencing () {
	  //PVSCL:IFCOND(ReviewMode)
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
    //PVSCL:ELSEIFCOND(EvidencingMode)
    let arrayOfTagGroups = _.values(this.model.currentTags)
    arrayOfTagGroups = _.orderBy(arrayOfTagGroups, 'config.options.criteriaId')
    for (let i = 0; i < arrayOfTagGroups.length; i++) {
      let tagGroup = arrayOfTagGroups[i]
      let button = this.createButton({
        name: tagGroup.config.name,
        color: ColorUtils.setAlphaToColor(tagGroup.config.color, 0.5),
        handler: (event) => {
          // Tags for current button
          let tags = [
            this.model.namespace + ':' + this.model.config.grouped.relation + ':' + tagGroup.config.name,
            'exam:cmid:' + window.abwa.contentTypeManager.fileMetadata.cmid
          ]
          // Check if it is already marked to get current mark
          let mark = window.abwa.specific.assessmentManager.marks[tagGroup.config.name]
          if (!_.isNull(mark.level)) {
            tags.push(this.model.namespace + ':' + this.model.config.grouped.subgroup + ':' + mark.level.name)
          }
          LanguageUtils.dispatchCustomEvent(Events.annotate, {tags: tags})
        }})
      this.tagsContainer.evidencing.append(button)
    }
	//PVSCL:ENDCOND
  }
  
  //PVSCL:IFCOND(Student)
  createTagsButtonsForViewing () {
    this.viewingInterval = setInterval(() => {
      // Wait until current annotations are loaded
      if (window.abwa.contentAnnotator &&
        window.abwa.contentAnnotator.currentAnnotations &&
        window.abwa.contentAnnotator.currentAnnotations.length > 0) {
        // Create viewing annotations
        this.createViewingAnnotations()
        clearInterval(this.viewingInterval)
      }
    }, 1000)
  }

  createViewingAnnotations () {
    let currentAnnotations = window.abwa.contentAnnotator.currentAnnotations
    let tags = CircularJSON.parse(CircularJSON.stringify(this.currentTags))
    // Get tag groups for each annotation
    let tagGroups = _.uniq(_.map(currentAnnotations, (annotation) => {
      return _.find(tags, (tagGroup) => {
        return tagGroup.config.name === annotation.tags[0].replace('exam:isCriteriaOf:', '')
      })
    }))
    // Remove undefined values
    tagGroups = _.compact(tagGroups)
    // Remove tagGroups elements which are not the mark for the current student
    _.forEach(tagGroups, (tagGroup) => {
      _.remove(tagGroup.tags, (tag) => {
        return _.find(currentAnnotations, (annotation) => {
          let criteriaTag = _.find(annotation.tags, (annoTag) => {
            return annoTag.includes('exam:isCriteriaOf:')
          }).replace('exam:isCriteriaOf:', '')
          let markTag = _.find(annotation.tags, (annoTag) => {
            return annoTag.includes('exam:mark:')
          })
          if (markTag) {
            markTag = markTag.replace('exam:mark:', '')
            return tag.name !== markTag && tag.group.config.name === criteriaTag
          } else {
            return tag.group.config.name === criteriaTag
          }
        })
      })
    })
    // Instance as class prototype
    for (let i = 0; i < tagGroups.length; i++) {
      tagGroups[i] = new TagGroup(tagGroups[i].config, tagGroups[i].tags)
      for (let j = 0; j < tagGroups[i].tags.length; j++) {
        tagGroups[i].tags[j] = Tag.getInstance(tagGroups[i].tags[j], tagGroups[i])
      }
    }
    // Create buttons with qualifications
    for (let i = 0; i < tagGroups.length; i++) {
      let tagGroup = tagGroups[i]
      let panel = this.createGroupedButtons({
        name: tagGroup.config.name,
        color: tagGroup.config.color,
        elements: tagGroup.tags,
        buttonHandler: (event) => {
          window.abwa.contentAnnotator.goToAnnotationOfTag('exam:isCriteriaOf:' + tagGroup.config.name)
        }
      })
      this.tagsContainer.viewing.append(panel)
    }
  }
  //PVSCL:ENDCOND
  
  //PVSCL:IFCOND(NOT(Spreadsheet))
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
    //PVSCL:IFCOND(DefaultCriterias)
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
    //PVSCL:ELSECOND
    tagButton.addEventListener('mouseenter', () => {
      let darkerAlpha = ColorUtils.colorFromString(tagButton.dataset.baseColor).valpha + 0.2
      tagButton.style.backgroundColor = ColorUtils.setAlphaToColor(ColorUtils.colorFromString(tagButton.dataset.baseColor), darkerAlpha)
    })
    tagButton.addEventListener('mouseleave', () => {
      tagButton.style.backgroundColor = tagButton.dataset.baseColor
    })
    //PVSCL:ENDCOND
    return tagButton
  }
  
  static createGroupedButtons ({name, color = 'white', elements, groupHandler, buttonHandler}) {
    // Create the container
    let tagGroupTemplate = document.querySelector('#tagGroupTemplate')
    let tagGroup = $(tagGroupTemplate.content.firstElementChild).clone().get(0)
    //PVSCL:IFCOND(Mark)
    tagGroup.dataset.criteria = name
    //PVSCL:ENDCOND
    let tagButtonContainer = $(tagGroup).find('.tagButtonContainer')
    let groupNameSpan = tagGroup.querySelector('.groupName')
    groupNameSpan.innerText = name
    groupNameSpan.title = name
    //PVSCL:IFCOND(Mark)
    groupNameSpan.dataset.clickable = 'true'
    //PVSCL:ENDCOND
    // Create event handler for tag group
    groupNameSpan.addEventListener('click', groupHandler)
    // Create buttons and add to the container
    if (/*PVSCL:IFCOND(DefaultCriterias)*/ _.isArray(elements) && /*PVSCL:ENDCOND*/ elements.length > 0) { // Only create group containers for groups which have elements
      for (let i = 0; i < elements.length; i++) {
        let element = elements[i]
        //PVSCL:IFCOND(Mark)
        let button = this.createButton({
        //PVSCL:ELSECOND
        let button = TagManager.createButton({
        //PVSCL:ENDCOND
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
  //PVSCL:ENDCOND
  
  initEventHandlers (callback) {
	//PVSCL:IFCOND(UserFilter)
	// For user filter change
	this.events.updatedCurrentAnnotationsEvent = {element: document, event: Events.updatedCurrentAnnotations, handler: this.createUpdatedCurrentAnnotationsEventHandler()}
	this.events.updatedCurrentAnnotationsEvent.element.addEventListener(this.events.updatedCurrentAnnotationsEvent.event, this.events.updatedCurrentAnnotationsEvent.handler, false)
	//PVSCL:ENDCOND
	//PVSCL:IFCOND(ModeSelector)
	// For mode change
    this.events.modeChange = {
      element: document,
      event: Events.modeChanged,
      handler: (event) => { this.modeChangeHandler(event) }
    }
    this.events.modeChange.element.addEventListener(this.events.modeChange.event, this.events.modeChange.handler, false)
	//PVSCL:ENDCOND
	//PVSCL:IFCOND(New)
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
    //PVSCL:ENDCOND
    if (_.isFunction(callback)) {
      callback()
    }
  }
  
  //PVSCL:IFCOND(New)
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
  //PVSCL:ENDCOND
    
  //PVSCL:IFCOND(Index)
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
  //PVSCL:ENDCOND
  
  modeChangeHandler (event) {
	//PVSCL:IFCOND(HighlightMode AND IndexMode)
	if (event.detail.mode === ModeManager.modes.highlight) {
	  // Show all the tags
      this.showAllTagsContainer()
	} else if (event.detail.mode === ModeManager.modes.index) {
	  // TODO Update index tags (it is not really required because everytime user create/delete annotation is updated)
	  this.showIndexTagsContainer()
	}
	//PVSCL:ELSEIFCOND(ReviewMode)
    if (event.detail.mode === ModeManager.modes.evidencing) {
        this.showEvidencingTagsContainer()
    }
	//PVSCL:ELSECOND
	this.showTagsContainerForMode(event.detail.mode)
	//PVSCL:ENDCOND
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
  //PVSCL:IFCOND(EvidencingMode OR ReviewMode)
  showEvidencingTagsContainer () {
    //PVSCL:IFCOND(NOT(ReviewMode))
	$(this.tagsContainer.viewing).attr('aria-hidden', 'true')
    $(this.tagsContainer.marking).attr('aria-hidden', 'true')
    //PVSCL:ENDCOND
    $(this.tagsContainer.evidencing).attr('aria-hidden', 'false')
  }
  //PVSCL:ENDCOND
  
  //PVSCL:IFCOND(DefaultCriterias)
  reorderNoGroupedTagContainer (order, container) {
    // Reorder marking container
    for (let i = order.length - 1; i >= 0; i--) {
      let criteria = order[i]
      let tagButton = _.find(container.querySelectorAll('.tagButton'), (elem) => { return elem.title === criteria })
      let elem = $(tagButton).detach()
      $(container).prepend(elem)
    }
  }
  //PVSCL:ENDCOND
  //PVSCL:IFCOND(MarkingMode)
  showMarkingTagsContainer () {
    $(this.tagsContainer.viewing).attr('aria-hidden', 'true')
    $(this.tagsContainer.marking).attr('aria-hidden', 'false')
    $(this.tagsContainer.evidencing).attr('aria-hidden', 'true')
  }
  //PVSCL:ENDCOND
  showViewingTagsContainer () {
    $(this.tagsContainer.viewing).attr('aria-hidden', 'false')
    $(this.tagsContainer.marking).attr('aria-hidden', 'true')
    $(this.tagsContainer.evidencing).attr('aria-hidden', 'true')
  }
  //PVSCL:IFCOND(Spreadsheet)
  showAllTagsContainer () {
    $(this.tagsContainer.index).attr('aria-hidden', 'true')
    $(this.tagsContainer.annotate).attr('aria-hidden', 'false')
  }
  showIndexTagsContainer () {
    $(this.tagsContainer.index).attr('aria-hidden', 'false')
    $(this.tagsContainer.annotate).attr('aria-hidden', 'true')
  }
  //PVSCL:ENDCOND
  
  //PVSCL:IFCOND(Spreadsheet)
  getGroupAndSubgroup (annotation) {
    let tags = annotation.tags
    let group = null
    let subGroup = null
    let groupOf = _.find(tags, (tag) => { return _.startsWith(tag, this.model.namespace + ':' + this.model.config.grouped.relation + ':') })
    if (groupOf) {
      subGroup = _.find(tags, (tag) => { return _.startsWith(tag, this.model.namespace + ':' + this.model.config.grouped.subgroup + ':') })
        .replace(this.model.namespace + ':' + this.model.config.grouped.subgroup + ':', '')
      group = groupOf.replace(this.model.namespace + ':' + this.model.config.grouped.relation + ':', '')
    } else {
      let groupTag = _.find(tags, (tag) => { return _.startsWith(tag, this.model.namespace + ':' + this.model.config.grouped.group + ':') })
      if (groupTag) {
        group = groupTag.replace(this.model.namespace + ':' + this.model.config.grouped.group + ':', '')
      }
    }
    return {group: group, subgroup: subGroup}
  }
  //PVSCL:ELSECOND
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
    if (/*PVSCL:IFCOND(DefaultCriteria)*/ annotation.tags.length > 1 /*PVSCL:ELSECOND*/ _.isObject(groupTag) /*PVSCL:ENDCOND*/) {
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
      return tag.includes(/*PVSCL:IFCOND(Marks)*/ 'exam:isCriteriaOf:' /*PVSCL:ELSECOND*/ 'review:isCriteriaOf:' /*PVSCL:ENDCOND*/)
    }).replace(/*PVSCL:IFCOND(Marks)*/ 'exam:isCriteriaOf:' /*PVSCL:ELSECOND*/ 'review:isCriteriaOf:' /*PVSCL:ENDCOND*/, '')
    return _.find(window.abwa.tagManager.currentTags, (tagGroupInstance) => {
      //PVSCL:IFCOND(Marks)
      return criteriaName === tagGroupInstance.config.name
      //PVSCL:ELSECOND
      return criteriaTag === tagGroupInstance.config.name
      //PVSCL:ENDCOND
    })
  }

  getCodeFromAnnotation (annotation, groupTag) {
    let markTag = _.find(annotation.tags, (tag) => {
      return tag.includes(/*PVSCL:IFCOND(Mark)*/ 'exam:mark:' /*PVSCL:ELSECOND*/ 'review:level:' /*PVSCL:ENDCOND*/)
    }).replace(/*PVSCL:IFCOND(Mark)*/ 'exam:mark:' /*PVSCL:ELSECOND*/'review:level:' /*PVSCL:ENDCOND*/, '')
    return _.find(groupTag.tags, (tagInstance) => {
      //PVSCL:IFCOND(Mark)
      return markName === tagInstance.name
      //PVSCL:ELSECOND
      return markTag.includes(tagInstance.name)
      //PVSCL:ENDCOND
    })
  }

  hasCodeAnnotation (annotation) {
    return _.some(annotation.tags, (tag) => {
      return tag.includes(/*PVSCL:IFCOND(Mark)*/ 'exam:mark:' /*PVSCL:ELSECOND*/ 'review:level:' /*PVSCL:ENDCOND*/)
    })
  }
  /*PVSCL:ENDCOND*/
  initTagsStructure (callback) {
    //PVSCL:IFCOND(Spreadsheet)
	let tagWrapperUrl = chrome.extension.getURL('pages/sidebar/tagWrapper.html')
    $.get(tagWrapperUrl, (html) => {
      $('#abwaSidebarContainer').append($.parseHTML(html))
      this.tagsContainer = {annotate: document.querySelector('#tagsAnnotate'), index: document.querySelector('#tagsIndex')}
      if (this.model.namespace === 'exam') {
        // Hide the content of the tags sidebar until they are ordered
        this.tagsContainer.annotate.dataset.examHidden = 'true'
      }
      if (_.isFunction(callback)) {
        callback()
      }
    })
    //PVSCL:ELSECOND
    let tagWrapperUrl = chrome.extension.getURL('pages/sidebar/tagWrapper.html')
    $.get(tagWrapperUrl, (html) => {
      $('#abwaSidebarContainer').append($.parseHTML(html))
      this.tagsContainer = {evidencing: document.querySelector('#tagsEvidencing')}
      if (_.isFunction(callback)) {
        callback()
      }
    })
    //PVSCL:ENDCOND
  }
}
  
module.exports = TagManager