const Events = {
  annotate: 'annotate',
  annotationCreated: 'annotationCreated',
  annotationDeleted: 'annotationDeleted',
  //PVSCL:IFCOND(Validations, LINE)
  annotationValidated: 'annotationValidated',
  //PVSCL:ENDCOND
  //PVSCL:IFCOND(Marks, LINE)
  mark: 'mark',
  //PVSCL:ENDCOND
  //PVSCL:IFCOND(ModeSelector, LINE)
  modeChanged: 'modeChanged',
  //PVSCL:ENDCOND
  //PVSCL:IFCOND(UserFilter, LINE)
  userFilterChange: 'userFilterChange',
  //PVSCL:ENDCOND
  updatedCurrentAnnotations: 'updatedCurrentAnnotations',
  updatedDocumentURL: 'updatedDocumentURL',
  //PVSCL:IFCOND(Comments, LINE)
  comment: 'annotationComment',
  //PVSCL:ENDCOND
  //PVSCL:IFCOND(Replys, LINE)
  reply: 'reply',
  //PVSCL:ENDCOND
  //PVSCL:IFCOND(AllDeleter, LINE)
  tagsUpdated: 'tagsUpdated',
  deleteAllAnnotations: 'deleteAllAnnotations',
  deletedAllAnnotations: 'deletedAllAnnotations',
  //PVSCL:ENDCOND
  updatedAllAnnotations: 'updatedAllAnnotations'
}

module.exports = Events