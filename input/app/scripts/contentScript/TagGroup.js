const ColorUtils = require('../utils/ColorUtils')
const Tag = require('./Tag')

class TagGroup {
  constructor (config, tags) {
    this.config = config
    this.tags = tags || []
    this.config.color = this.config.color || 'rgba(150,150,150,0.5)'
  }

  //PVSCL:IFCOND((HighlightMode OR ReviewMode) AND IndexMode, LINE)
  createPanel (indexRole) {
    if (this.tags.length > 0) {
      let tagGroupTemplate = document.querySelector('#tagGroupTemplate')
      let tagGroup = $(tagGroupTemplate.content.firstElementChild).clone().get(0)
      let tagButtonContainer = $(tagGroup).find('.tagButtonContainer')
      let groupNameSpan = tagGroup.querySelector('.groupName')
      groupNameSpan.innerText = this.config.name
      groupNameSpan.title = this.config.name
      for (let j = 0; j < this.tags.length; j++) {
        let tagButton = this.tags[j].createButton()
        if (indexRole) {
          tagButton.setAttribute('role', Tag.roles.index)
        }
        tagButtonContainer.append(tagButton)
      }
      return tagGroup
    }
  }
  //PVSCL:ENDCOND
  getColor () {
    return ColorUtils.setAlphaToColor(this.config.color, 0.5)
  }
}

module.exports = TagGroup