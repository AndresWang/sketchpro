@import 'common.js'

var instanceSymbolDic = [NSMutableDictionary new]
var instanceSymbolIDs = NSMutableArray.array()
var artboardIDDic = [NSMutableDictionary new]

// MARK: Consistency
function consistency(context) {
    // Check consistency
    var doc = context.document
    var styleConsistency = checkStyleConsistency(doc)
    if (styleConsistency.styleIsSynced == false) {return}
    var symbolConsistency = checkSymbolConsistency(doc)

    if (styleConsistency.styleIsSynced && symbolConsistency.instanceNameIsIndependent) {
        var orphanStyleText = ""
        if (styleConsistency.orphanNames.length > 0) {
            orphanStyleText = "\n\n*Orphan Styles*\n" + styleConsistency.orphanNames.join("\n")
        }
        var orphanSymbolText = ""
        if (symbolConsistency.orphanMasterNames.length > 0) {
            orphanSymbolText = "\n\n*Orphan Symbols*\n" + symbolConsistency.orphanMasterNames.join("\n")
        }

        // Sync Colors
        syncLayerStyleColorsWithDoc(doc)
        addTextStyleColorIfNotInDoc(doc)

        generateStyleGuide(doc)
        showAlert("Consistency", "1. Shared Styles synced\n2. Symbol Instances' name are independent\n3. Document colors synced\n4. Style Guide updated" + orphanStyleText + orphanSymbolText)
    }
}
// MARK: Helper Methods
function checkStyleConsistency(doc) {
    var layerStyles = doc.documentData().layerStyles().objects()
    var textStyles = doc.documentData().layerTextStyles().objects()
    var allSharedStyles = layerStyles.arrayByAddingObjectsFromArray(textStyles)
    var orphanMonitor = allSharedStyles.slice()
    var styleList = allSharedStyles.slice()

    var nonStylePage = NSPredicate.predicateWithFormat("name != %@", "Style Guide")
    var layerPredicate = NSPredicate.predicateWithFormat("class == %@ || class == %@", MSShapeGroup, MSTextLayer)
    var layers = searchLayersInsideArtboards(doc, nonStylePage, layerPredicate)

    // select style if is an orphan, else update the style to the newest version
    for (var k = 0; k < layers.count(); k++) {
        var layer = layers[k]
        var sharedID = layer.style().sharedObjectID()
        if (sharedID == nil) {
            jumpToArtboard(doc, layer.parentArtboard())
            layer.select_byExpandingSelection(true, false)
            doc.showMessage("Layer without shared style")
            return {styleIsSynced: false, orphanNames: nil}
        } else {
            var predicate = NSPredicate.predicateWithFormat("objectID == %@",sharedID)
            var mySharedObject = allSharedStyles.filteredArrayUsingPredicate(predicate).firstObject()
            // Prevent nil in rare cases because of Sketch's bug (text style detached itself when we apply some shape style to it)
            if (mySharedObject != nil) {layer.setStyle(mySharedObject.newInstance())}

            // Find orphan styles
            var objectIndex = orphanMonitor.indexOf(mySharedObject)
            if (objectIndex != -1) { // Found object
                orphanMonitor.splice(objectIndex, 1)
            }
        }
    }

    var orphanNames = orphanMonitor.map(function(x){return x.name()})
    doc.reloadInspector()
    return {styleIsSynced: true, orphanNames: orphanNames}
}
function checkSymbolConsistency(doc) {
    var masters = doc.documentData().allSymbols()
    var nonStylePage = NSPredicate.predicateWithFormat("name != %@", "Style Guide")
    var layerPredicate = NSPredicate.predicateWithFormat("class == %@ ", MSSymbolInstance)
    var instances = searchLayersInsideArtboards(doc, nonStylePage, layerPredicate)
    var orphanMasterNames = []

    // Check if instance has independent name, and extract its all symbolIDs
    for (var i = 0; i < instances.count(); i++) {
        var instance = instances[i]
        var instanceName = instance.name()
        var masterName = instance.symbolMaster().name()
        if ([instanceName isEqualToString: masterName]) {
            jumpToArtboard(doc, instance.parentArtboard())
            instance.select_byExpandingSelection(true, false)
            doc.showMessage("Instance without independent name")
            return {instanceNameIsIndependent: false, orphanMasterNames: nil}
        }

        extractSymbolIDsFromInstance(doc, instance, nil)
        [instanceSymbolDic removeAllObjects]
    }

    // Find orphan symbols
    for (var j = 0; j < masters.count(); j++) {
        var masterSymbolID = masters[j].symbolID()
        if ([instanceSymbolIDs containsObject: masterSymbolID] == false) {
            var predicate = NSPredicate.predicateWithFormat("symbolID == %@",masterSymbolID)
            var orphanMasterName = masters.filteredArrayUsingPredicate(predicate).firstObject().name()
            orphanMasterNames.push(orphanMasterName)
        }
    }

    return {instanceNameIsIndependent: true, orphanMasterNames: orphanMasterNames}
}
function syncLayerStyleColorsWithDoc(doc) {
    var colors = NSMutableArray.array()
    var gradients = NSMutableArray.array()
    var patterns = NSMutableArray.array()
    var layerStyles = doc.documentData().layerStyles().objects()

    // LayerStyle
    for (var i = 0; i < layerStyles.count(); i++) {
        var layerStyle = layerStyles[i]
        var fills = layerStyle.style().fills()
        var borders = layerStyle.style().borders()
        var shadows = layerStyle.style().shadows()
        var innerShadows = layerStyle.style().innerShadows()

        // All enabled fill colors
        for (var j = 0; j < fills.count(); j++) {
            var fill = fills[j]
            if (fill.isEnabled()) {
                switch(fill.fillType()) {
                    case 0:
                        var fillColor = fill.color()
                        var colorValues = NSMutableArray.array()
                        for (var z = 0; z < colors.length; z++) {
                            var value = colors[z].description()
                            [colorValues addObject: value]
                        }
                        if ([colorValues containsObject: fillColor.description()] == false) {[colors addObject: fillColor]}
                        break
                    case 1:
                        var fillGradient = fill.gradient().CSSAttributeStringWithMasterAlpha(1)
                        var cssGradients = NSMutableArray.array()
                        for (var z = 0; z < gradients.length; z++) {
                            var attributes = gradients[z].CSSAttributeStringWithMasterAlpha(1)
                            [cssGradients addObject: attributes]
                        }
                        if ([cssGradients containsObject: fillGradient] == false) {[gradients addObject: fill.gradient()]}
                        break
                    case 4:
                        var fillPattern = fill.image()
                        if ([patterns containsObject: fillPattern] == false) {[patterns addObject: fillPattern]}
                        break
                    default: print("Noise Fill") ; break
                }
            }
        }

        // All enabled border colors
        for (var k = 0; k < borders.count(); k++) {
            var border = borders[k]
            if (border.isEnabled()) {
                switch(border.fillType()) {
                    case 0:
                        var fillColor = border.color()
                        var colorValues = NSMutableArray.array()
                        for (var z = 0; z < colors.length; z++) {
                            var value = colors[z].description()
                            [colorValues addObject: value]
                        }
                        if ([colorValues containsObject: fillColor.description()] == false) {[colors addObject: fillColor]}
                        break
                    case 1:
                        var borderGradient = border.gradient().CSSAttributeStringWithMasterAlpha(1)
                        var cssGradients = NSMutableArray.array()
                        for (var z = 0; z < gradients.length; z++) {
                            var attributes = gradients[z].CSSAttributeStringWithMasterAlpha(1)
                            [cssGradients addObject: attributes]
                        }
                        if ([cssGradients containsObject: borderGradient] == false) {[gradients addObject: border.gradient()]}
                        break
                    default: break
                }
            }
        }

        // All enabled shadow colors
        for (var l = 0; l < shadows.count(); l++) {
            var shadow = shadows[l]
            if (shadow.isEnabled()) {
                var fillColor = shadow.color()
                var colorValues = NSMutableArray.array()
                for (var z = 0; z < colors.length; z++) {
                    var value = colors[z].description()
                    [colorValues addObject: value]
                }
                if ([colorValues containsObject: fillColor.description()] == false) {[colors addObject: fillColor]}
            }
        }

        // All enabled innerShadow colors
        for (var m = 0; m < innerShadows.count(); m++) {
            var innerShadow = innerShadows[m]
            if (innerShadow.isEnabled()) {
                var fillColor = innerShadow.color()
                var colorValues = NSMutableArray.array()
                for (var z = 0; z < colors.length; z++) {
                    var value = colors[z].description()
                    [colorValues addObject: value]
                }
                if ([colorValues containsObject: fillColor.description()] == false) {[colors addObject: fillColor]}
            }
        }
    }
    doc.documentData().assets().setColors(colors)
    doc.documentData().assets().setGradients(gradients)
    doc.documentData().assets().setImages(patterns)
}
function addTextStyleColorIfNotInDoc(doc) {
    var docColors = doc.documentData().assets().colors()
    var docGradients = doc.documentData().assets().gradients()
    var docPatterns = doc.documentData().assets().images()

    var textStyles = doc.documentData().layerTextStyles().objects()

    for (var i = 0; i < textStyles.length; i++) {
        var textStyle = textStyles[i]

        // Check text color
        var textAttributes = textStyle.style().textStyle().attributes()
        var textNsColor = textAttributes.MSAttributedStringColorAttribute
        var textColor = MSColor.colorWithRed_green_blue_alpha(textNsColor.red(), textNsColor.green(), textNsColor.blue(), textNsColor.alpha())
        if (textColorExistInDoc(textColor, docColors) == false) {[docColors addObject: textColor]}

        var fills = textStyle.style().fills()
        var borders = textStyle.style().borders()
        var shadows = textStyle.style().shadows()
        var innerShadows = textStyle.style().innerShadows()

        // Check all enabled fill colors
        for (var j = 0; j < fills.count(); j++) {
            var fill = fills[j]
            if (fill.isEnabled()) {
                switch(fill.fillType()) {
                    case 0:
                        var fillColor = fill.color()
                        var colorValues = NSMutableArray.array()
                        for (var z = 0; z < docColors.length; z++) {
                            var value = docColors[z].description()
                            [colorValues addObject: value]
                        }
                        if ([colorValues containsObject: fillColor.description()] == false) {[docColors addObject: fillColor]}
                        break
                    case 1:
                        var fillGradient = fill.gradient().CSSAttributeStringWithMasterAlpha(1)
                        var cssDocGradients = NSMutableArray.array()
                        for (var z = 0; z < docGradients.length; z++) {
                            var attributes = docGradients[z].CSSAttributeStringWithMasterAlpha(1)
                            [cssDocGradients addObject: attributes]
                        }
                        if ([cssDocGradients containsObject: fillGradient] == false) {[docGradients addObject: fill.gradient()]}
                        break
                    case 4:
                        var fillPattern = fill.image()
                        if ([docPatterns containsObject: fillPattern] == false) {[docPatterns addObject: fillPattern]}
                        break
                    default: print("Noise Fill") ; break
                }
            }
        }

        // Check all enabled border colors
        for (var k = 0; k < borders.count(); k++) {
            var border = borders[k]
            if (border.isEnabled()) {
                switch(border.fillType()) {
                    case 0:
                        var fillColor = border.color()
                        var colorValues = NSMutableArray.array()
                        for (var z = 0; z < docColors.length; z++) {
                            var value = docColors[z].description()
                            [colorValues addObject: value]
                        }
                        if ([colorValues containsObject: fillColor.description()] == false) {[docColors addObject: fillColor]}
                        break
                    case 1:
                        var borderGradient = border.gradient().CSSAttributeStringWithMasterAlpha(1)
                        var cssDocGradients = NSMutableArray.array()
                        for (var z = 0; z < docGradients.length; z++) {
                            var attributes = docGradients[z].CSSAttributeStringWithMasterAlpha(1)
                            [cssDocGradients addObject: attributes]
                        }
                        if ([cssDocGradients containsObject: borderGradient] == false) {[docGradients addObject: border.gradient()]}
                        break
                    default: break
                }
            }
        }

        // Check all enabled shadow colors
        for (var l = 0; l < shadows.count(); l++) {
            var shadow = shadows[l]
            if (shadow.isEnabled()) {
                var fillColor = shadow.color()
                var colorValues = NSMutableArray.array()
                for (var z = 0; z < docColors.length; z++) {
                    var value = docColors[z].description()
                    [colorValues addObject: value]
                }
                if ([colorValues containsObject: fillColor.description()] == false) {[docColors addObject: fillColor]}
            }
        }

        // Check all enabled innerShadow colors
        for (var m = 0; m < innerShadows.count(); m++) {
            var innerShadow = innerShadows[m]
            if (innerShadow.isEnabled()) {
                var fillColor = innerShadow.color()
                var colorValues = NSMutableArray.array()
                for (var z = 0; z < docColors.length; z++) {
                    var value = docColors[z].description()
                    [colorValues addObject: value]
                }
                if ([colorValues containsObject: fillColor.description()] == false) {[docColors addObject: fillColor]}
            }
        }
    }
}
function generateStyleGuide(doc) {
    var pages = doc.pages()
    var pagePredicate = NSPredicate.predicateWithFormat("name == %@", "Style Guide")
    var stylePage = pages.filteredArrayUsingPredicate(pagePredicate).firstObject()
    
    // Create page if none
    if (stylePage == nil) {
        doc.addBlankPage()
        stylePage = doc.currentPage()
        stylePage.name = "Style Guide"
    } else {
        if (doc.currentPage() != stylePage) {doc.setCurrentPage(stylePage)}
    }

    doc.currentPage().changeSelectionBySelectingLayers(nil)
    layerStyleGuide(doc, stylePage)
    textStyleGuide(doc, stylePage)
    guideline(doc, stylePage)
    collapseArtboardsAndGroups(doc)
}
function layerStyleGuide(doc, stylePage) {
    var layerStyles = doc.documentData().layerStyles().objects()
    layerStyles.sort(sortByStyleName)
    
    // Create artboard if none, otherwise clear all layers in it
    var predicate = NSPredicate.predicateWithFormat("name == %@", "Layer Styles")
    var layerStyleArtboard = doc.currentPage().artboards().filteredArrayUsingPredicate(predicate).firstObject()
    
    if (layerStyleArtboard == nil) {
        var boardConfig = {parent: stylePage, name: "Layer Styles", x: 100, y: 50, width: 0, height: 0}
        layerStyleArtboard = createArtboard(boardConfig, nil)
    } else {
        layerStyleArtboard.removeAllLayers()
    }
    
    var labelY = 0
    var labelColor = MSColor.colorWithRed_green_blue_alpha(0, 0, 0, 1)
    var groupConfig = {parent: layerStyleArtboard, name: "Labels"}
    var textGroup = createGroup(groupConfig)

    for (var i = 0; i < layerStyles.count(); i++) {
        var layerStyle = layerStyles[i]

        // Style Label
        var labelConfig = {parent: textGroup, name: layerStyle.name(), string: layerStyle.name(), fontPostscriptName: "HelveticaNeue-Regular",textColor: labelColor, fontSize: 12, x: 0, y: labelY}
        var label = createText(labelConfig)
        labelY += (label.frame().height() + 5)

        // Style Rectangle
        var recConfig =  {parent: layerStyleArtboard, name: layerStyle.name(), x: 0, y: labelY, width: 25, height: 25}
        var styleRec = createRectangle(recConfig)
        styleRec.setStyle(layerStyle.newInstance())
        labelY += (styleRec.frame().height() + 5)
    }
    
    textGroup.resizeToFitChildrenWithOption(nil)
    textGroup.setIsLocked(true)
    layerStyleArtboard.select_byExtendingSelection(true, false)
    resizeCurrentArtboard(doc)
    layerStyleArtboard.select_byExtendingSelection(false, false)
}
function textStyleGuide(doc, stylePage) {
    var textStyles = doc.documentData().layerTextStyles().objects()
    textStyles.sort(sortByStyleName)
    
    // Create artboard if none, otherwise clear all layers in it
    var predicate = NSPredicate.predicateWithFormat("name == %@", "Text Styles")
    var textStyleArtboard = doc.currentPage().artboards().filteredArrayUsingPredicate(predicate).firstObject()
    
    if (textStyleArtboard == nil) {
        var boardConfig = {parent: stylePage, name: "Text Styles", x: 0, y: 50, width: 0, height: 0}
        textStyleArtboard = createArtboard(boardConfig, nil)
    } else {
        textStyleArtboard.removeAllLayers()
    }
    
    var labelY = 0
    var texts = []
    for (var i = 0; i < textStyles.count(); i++) {
        var textStyle = textStyles[i]
        var textConfig = {parent: textStyleArtboard, name: textStyle.name(), string: textStyle.name(), fontPostscriptName: "",textColor: nil, fontSize: 0, x: 0, y: labelY}
        var text = createText(textConfig)
        text.setStyle(textStyle.newInstance())
        texts.push(text)
        labelY += (text.frame().height() + 5)
    }

    textStyleArtboard.select_byExtendingSelection(true, false)
    resizeCurrentArtboard(doc)
    textStyleArtboard.select_byExtendingSelection(false, false)
    
    // Adust textStyleArtboards x position
    var predicate = NSPredicate.predicateWithFormat("name == %@", "Layer Styles")
    var layerStyleArtboard = doc.currentPage().artboards().filteredArrayUsingPredicate(predicate).firstObject()
    var textStyleArtboardX = layerStyleArtboard.frame().x() + layerStyleArtboard.frame().width() + 100
    textStyleArtboard.frame().setX(textStyleArtboardX)

    // Handle alignment & background
    var groupConfig = {parent: textStyleArtboard, name: "Backgrounds"}
    var bgGroup = createGroup(groupConfig)
    for (var j = 0; j < texts.length; j++) {
        var text = texts[j]
        var paragraphStyle = text.style().textStyle().attributes().NSParagraphStyle
        var alignment = (paragraphStyle == nil) ? 0 : paragraphStyle.alignment()
        text.select_byExtendingSelection(true, false)
        if (alignment == 0) {
            sketchAction.alignLayersLeft(doc)
        } else if (alignment == 1) {
            sketchAction.alignLayersRight(doc)
        } else if (alignment == 2) {
            sketchAction.alignLayersCenter(doc)
        } else {
            sketchAction.alignLayersCenter(doc)
        }

        var textColor = text.textColor()
        if ((textColor.red() + textColor.green() + textColor.blue()) > (2 * textColor.alpha())) {
            var recConfig =  {parent: bgGroup, name: (text.name() + "'s bg"), x: text.frame().x(), y: text.frame().y(), width: text.frame().width(), height: text.frame().height()}
            var bgRec = createRectangle(recConfig)
            var bgFill = bgRec.style().addStylePartOfType(0)
            bgFill.color = MSImmutableColor.colorWithSVGString("#626262").newMutableCounterpart()
        }
    }

    bgGroup.resizeToFitChildrenWithOption(nil)
    bgGroup.select_byExtendingSelection(true, false)
    sketchAction.moveToBack(doc)
    bgGroup.select_byExtendingSelection(false, false)
    bgGroup.setIsLocked(true)
}
function sortByStyleName(a, b){
    return a.name().localeCompare(b.name())
}
function textColorIsEqual(textColor, color) {
    var textColorHex = textColor.immutableModelObject().hexValue().toString()
    var colorHex = color.immutableModelObject().hexValue().toString()
    return [textColorHex isEqualToString: colorHex] && textColor.alpha() == color.alpha()
}
function textColorExistInDoc(textColor, docColors) {
    for (var i = 0; i < docColors.count(); i++) {
        var docColor = docColors[i]
        if (textColorIsEqual(textColor, docColor)) {return true}
    }
    return false
}

// MARK: Guideline
function guideline(doc, stylePage) {
    var guidelineArtboard = handleGuidelineArtboard(doc, stylePage)
    removeColorRecIfNotShownInDoc(doc, guidelineArtboard)
    removeFontTextIfNotShownInDoc(doc, guidelineArtboard)
    removeIconIfNotSymbolWithSlice(doc, guidelineArtboard)
    clearOldStandByStyles(stylePage)
    addDocColorIfNotShownInGuideline(doc, stylePage, guidelineArtboard)
    addFontIfNotShownInGuideline(doc, stylePage, guidelineArtboard)
    addIconIfNotShownInGuideline(doc, stylePage, guidelineArtboard)
}
function handleGuidelineArtboard(doc, stylePage) {
    var predicate = NSPredicate.predicateWithFormat("name == %@", "Guideline")
    var guidelineArtboard = doc.currentPage().artboards().filteredArrayUsingPredicate(predicate).firstObject()
    
    if (guidelineArtboard == nil) {
        var boardConfig = {parent: stylePage, name: "Guideline", x: 0, y: 50, width: 400, height: 400}
        guidelineArtboard = createArtboard(boardConfig, nil)
    }
    
    // Adust guidelineArtboard x position
    var textStylePredicate = NSPredicate.predicateWithFormat("name == %@", "Text Styles")
    var textStyleArtboard = doc.currentPage().artboards().filteredArrayUsingPredicate(textStylePredicate).firstObject()
    var artboardX = textStyleArtboard.frame().x() + textStyleArtboard.frame().width() + 100
    guidelineArtboard.frame().setX(artboardX)
    
    return guidelineArtboard
}
function clearOldStandByStyles(stylePage) {
    var predicate = NSPredicate.predicateWithFormat("class != %@", MSArtboardGroup)
    var oldStandByStyles = stylePage.layers().filteredArrayUsingPredicate(predicate)
    for (var i = 0; i < oldStandByStyles.length; i++) {oldStandByStyles[i].removeFromParent()}
}
function addDocColorIfNotShownInGuideline(doc, stylePage, guidelineArtboard) {
    var docColors = doc.documentData().assets().colors()
    var docGradients = doc.documentData().assets().gradients()
    var docPatterns = doc.documentData().assets().images()
    var lastX = guidelineArtboard.frame().x()
    var standByY = guidelineArtboard.frame().y() + guidelineArtboard.frame().height() + 20
    
    var currentColors = currentGuidelineColors("color", guidelineArtboard)
    var currentGradients = currentGuidelineColors("gradient", guidelineArtboard)
    var currentPatterns = currentGuidelineColors("pattern", guidelineArtboard)
    
    for (var i = 0; i < docColors.length; i++) {
        var color = docColors[i]
        if ([currentColors containsObject: color] == false) {
            var recConfig = {parent: stylePage, name: "color", x: lastX, y: standByY, width: 25, height: 25}
            var colorRec = createRectangle(recConfig)
            var fill = colorRec.style().addStylePartOfType(0)
            fill.color = color
            lastX += 25
        }
    }
    for (var j = 0; j < docGradients.length; j++) {
        var gradient = docGradients[j]
        if ([currentGradients containsObject: gradient] == false) {
            var recConfig = {parent: stylePage, name: "gradient", x: lastX, y: standByY, width: 25, height: 25}
            var colorRec = createRectangle(recConfig)
            var fill = colorRec.style().addStylePartOfType(0)
            fill.setFillType(1)
            fill.setGradient(gradient)
            lastX += 25
        }
    }
    for (var k = 0; k < docPatterns.length; k++) {
        var pattern = docPatterns[k]
        if ([currentPatterns containsObject: pattern] == false) {
            var recConfig = {parent: stylePage, name: "pattern", x: lastX, y: standByY, width: 25, height: 25}
            var colorRec = createRectangle(recConfig)
            var fill = colorRec.style().addStylePartOfType(0)
            fill.setFillType(4)
            fill.setImage(pattern)
            lastX += 25
        }
    }
}
function currentGuidelineColors(type, guidelineArtboard) {
    var colors = NSMutableArray.array()
    var predicate = NSPredicate.predicateWithFormat("name == %@ && class == %@", type, MSShapeGroup)
    var colorRecs = guidelineArtboard.children().filteredArrayUsingPredicate(predicate)
    for (var i = 0; i < colorRecs.length; i++) {
        var fill = colorRecs[i].style().fills().firstObject()
        var color = (type == "color") ? fill.color() : ((type == "gradient") ? fill.gradient() : fill.image())
        [colors addObject: color]
    }
    return colors
}
function removeColorRecIfNotShownInDoc(doc, guidelineArtboard) {
    var docColors = doc.documentData().assets().colors()
    var docGradients = doc.documentData().assets().gradients()
    var docPatterns = doc.documentData().assets().images()
    
    var guidelineElements = guidelineArtboard.children()
    
    var colorPredicate = NSPredicate.predicateWithFormat("name == %@ && class == %@", "color", MSShapeGroup)
    var colorRecs = guidelineElements.filteredArrayUsingPredicate(colorPredicate)
    for (var i = 0; i < colorRecs.length; i++) {
        var color = colorRecs[i].style().fills().firstObject().color()
        if ([docColors containsObject: color] == false) {colorRecs[i].removeFromParent()}
    }
    
    var gradientPredicate = NSPredicate.predicateWithFormat("name == %@ && class == %@", "gradient", MSShapeGroup)
    var gradientRecs = guidelineElements.filteredArrayUsingPredicate(gradientPredicate)
    for (var j = 0; j < gradientRecs.length; j++) {
        var gradient = gradientRecs[j].style().fills().firstObject().gradient()
        if ([docGradients containsObject: gradient] == false) {gradientRecs[j].removeFromParent()}
    }
    
    var patternPredicate = NSPredicate.predicateWithFormat("name == %@ && class == %@", "pattern", MSShapeGroup)
    var patternRecs = guidelineElements.filteredArrayUsingPredicate(patternPredicate)
    for (var k = 0; k < patternRecs.length; k++) {
        var pattern = patternRecs[k].style().fills().firstObject().image()
        if ([docPatterns containsObject: pattern] == false) {patternRecs[k].removeFromParent()}
    }
}
function addFontIfNotShownInGuideline(doc, stylePage, guidelineArtboard) {
    var textStyles = doc.documentData().layerTextStyles().objects()
    var lastX = guidelineArtboard.frame().x()
    var standByY = guidelineArtboard.frame().y() + guidelineArtboard.frame().height() + 20 + 25 + 20
    var currentFonts = currentGuidelineFonts(guidelineArtboard)
    var addedFonts = NSMutableArray.array()
    
    for (var i = 0; i < textStyles.length; i++) {
        var textStyle = textStyles[i]
        var fontInfo = extractFontInfo(textStyle)
        if ([currentFonts containsObject: fontInfo.name] == false && [addedFonts containsObject: fontInfo.name] == false) {
            var color = MSColor.colorWithRed_green_blue_alpha(0, 0, 0, 1)
            var textConfig = {parent: stylePage, name: "font", string: fontInfo.name, fontPostscriptName: fontInfo.family ,textColor: color, fontSize: fontInfo.size, x: lastX, y: standByY}
            var text = createText(textConfig)
            [addedFonts addObject: fontInfo.name]
            lastX += text.frame().width() + 20
        }
    }
}
function currentGuidelineFonts(guidelineArtboard) {
    var fontInfos = NSMutableArray.array()
    var predicate = NSPredicate.predicateWithFormat("name == %@ && class == %@", "font", MSTextLayer)
    var fontTexts = guidelineArtboard.children().filteredArrayUsingPredicate(predicate)
    for (var i = 0; i < fontTexts.length; i++) {
        var info = extractFontInfo(fontTexts[i]).name
        [fontInfos addObject: info]
    }
    return fontInfos
}
function extractFontInfo(text) {
    var fontDescriptor = text.style().textStyle().attributes().NSFont.fontDescriptor()
    var family = String(fontDescriptor.objectForKey(NSFontNameAttribute))
    var size = String(fontDescriptor.objectForKey(NSFontSizeAttribute))
    return {name: family + " " + size, family: family, size: size}
}
function removeFontTextIfNotShownInDoc(doc, guidelineArtboard) {
    var textStyles = doc.documentData().layerTextStyles().objects()
    var styleInfos = textStyles.slice().map(function(x){return extractFontInfo(x).name})
    
    var guidelineElements = guidelineArtboard.children()
    var fontPredicate = NSPredicate.predicateWithFormat("name == %@ && class == %@", "font", MSTextLayer)
    var fontTexts = guidelineElements.filteredArrayUsingPredicate(fontPredicate)
    for (var i = 0; i < fontTexts.length; i++) {
        var info = extractFontInfo(fontTexts[i]).name
        if (styleInfos.indexOf(info) == -1) {fontTexts[i].removeFromParent()}
    }
}
function addIconIfNotShownInGuideline(doc, stylePage, guidelineArtboard) {
    var pagePredicate = NSPredicate.predicateWithFormat("name == %@", "Symbols")
    var symbolPage = doc.pages().filteredArrayUsingPredicate(pagePredicate).firstObject()
    var mastersWithSlice = symbolPage.exportableLayers().slice().map(function(x){return x.parentArtboard()})
    var currentSymbolIDs = currentGuidelineIcons(guidelineArtboard)
    var addedIcons = NSMutableArray.array()
    var lastX = guidelineArtboard.frame().x()
    var standByY = guidelineArtboard.frame().y() + guidelineArtboard.frame().height() + 20 + 25 + 20 + 25 + 20
    for (var i = 0; i < mastersWithSlice.length; i++) {
        var masterWithSlice = mastersWithSlice[i]
        var notInGuideline = [currentSymbolIDs containsObject: masterWithSlice.symbolID()] == false
        var notAdded = [addedIcons containsObject: masterWithSlice] == false // Avoid duplicate master
        if (notInGuideline && notAdded) {
            [addedIcons addObject: masterWithSlice]
            var instance = masterWithSlice.newSymbolInstance()
            instance.setName("icon")
            instance.frame().setX(lastX)
            instance.frame().setY(standByY)
            stylePage.addLayers([instance])
            lastX += instance.frame().width() + 20
        }
    }
}
function currentGuidelineIcons(guidelineArtboard) {
    var iconSymbolIDs = NSMutableArray.array()
    var predicate = NSPredicate.predicateWithFormat("name == %@ && class == %@", "icon", MSSymbolInstance)
    var icons = guidelineArtboard.children().filteredArrayUsingPredicate(predicate)
    for (var i = 0; i < icons.length; i++) {
        [iconSymbolIDs addObject: icons[i].symbolID()]
    }
    return iconSymbolIDs
}
function removeIconIfNotSymbolWithSlice(doc, guidelineArtboard) {
    // Remove icon which is not a symbol
    var notSymbolIconPredicate = NSPredicate.predicateWithFormat("name == %@ && class != %@", "icon", MSSymbolInstance)
    var notSymbolIcons = guidelineArtboard.children().filteredArrayUsingPredicate(notSymbolIconPredicate)
    for (var i = 0; i < notSymbolIcons.length; i++) {
        notSymbolIcons[i].removeFromParent()
    }
    
    // Remove icon which its symbol master doesn't have slice
    var pagePredicate = NSPredicate.predicateWithFormat("name == %@", "Symbols")
    var symbolPage = doc.pages().filteredArrayUsingPredicate(pagePredicate).firstObject()
    var javaSymbolIDsWithSlice = symbolPage.exportableLayers().slice().map(function(x){return x.parentArtboard().symbolID()})
    var symbolIDsWithSlice = javaArrayToObjectiveC(javaSymbolIDsWithSlice)
    var iconPredicate = NSPredicate.predicateWithFormat("name == %@ && class == %@", "icon", MSSymbolInstance)
    var icons = guidelineArtboard.children().filteredArrayUsingPredicate(iconPredicate)
    for (var i = 0; i < icons.length; i++) {
        if ([symbolIDsWithSlice containsObject: icons[i].symbolID()] == false) {icons[i].removeFromParent()}
    }
}

// MARK: - Find Guideline Color/Font
function findGuidelineColorFont(context) {
    var doc = context.document
    var selection = context.selection
    var failTitle = "Fail to find Guideline Color/Font"
    var failMessage = "You should select a color or font in Guideline"
    
    if (selection.length != 1) {showAlert(failTitle, failMessage) ; return}
    
    var layer = selection[0]
    if (layer.parentArtboard() == nil) {showAlert(failTitle, failMessage) ; return}
    
    var layerArtboardName = layer.parentArtboard().name()
    var isColorFontLayer = layer.name() == "color" || layer.name() == "gradient" || layer.name() == "pattern" || layer.name() == "font"
    
    if (isColorFontLayer && layerArtboardName == "Guideline") {
        if (layer.name() == "font") {
            startCycleFont(doc, layer)
        } else {
            startCycleColor(doc, layer, layer.name())
        }
    } else if (layerArtboardName == "Layer Styles" || layerArtboardName == "Text Styles") {
        nextColorFontByJson(doc)
    } else {
       showAlert(failTitle, failMessage)
    }
}
function startCycleColor(doc, layer, type) {
    var styleLayerIDs = NSMutableArray.array()
    
    // Color
    var fill = layer.style().fills().firstObject()
    var color = (type == "color") ? fill.color() : ((type == "gradient") ? fill.gradient() : fill.image())
    
    // Layer Styles
    var layerArtboardPredicate = NSPredicate.predicateWithFormat("name == %@", "Layer Styles")
    var layerStyleArtboard = doc.currentPage().artboards().filteredArrayUsingPredicate(layerArtboardPredicate).firstObject()
    var layerPredicate = NSPredicate.predicateWithFormat("class == %@", MSShapeGroup)
    var layerStyles = layerStyleArtboard.layers().filteredArrayUsingPredicate(layerPredicate)
    
    layerStyleLoop:
    for (var i = 0; i < layerStyles.count(); i++) {
        var layerStyle = layerStyles[i]
        var fills = layerStyle.style().fills()
        var borders = layerStyle.style().borders()
        var shadows = layerStyle.style().shadows()
        var innerShadows = layerStyle.style().innerShadows()
        
        // All enabled fill colors
        for (var j = 0; j < fills.count(); j++) {
            var fill = fills[j]
            if (fill.isEnabled()) {
                switch(fill.fillType()) {
                    case 0:
                        var colorValue = color.description()
                        if ([colorValue isEqual: fill.color().description()]) {[styleLayerIDs addObject: layerStyle.objectID()] ; continue layerStyleLoop}
                        break
                    case 1:
                        if (type == "gradient") {
                            var colorGradient = color.CSSAttributeStringWithMasterAlpha(1)
                            var fillGradient = fill.gradient().CSSAttributeStringWithMasterAlpha(1)
                            if ([colorGradient isEqual: fillGradient]) {[styleLayerIDs addObject: layerStyle.objectID()] ; continue layerStyleLoop}
                        }
                        break
                    case 4:
                        if ([color isEqual: fill.image()]) {[styleLayerIDs addObject: layerStyle.objectID()] ; continue layerStyleLoop}
                        break
                    default: print("Noise Fill") ; break
                }
            }
        }
        
        // All enabled border colors
        for (var k = 0; k < borders.count(); k++) {
            var border = borders[k]
            if (border.isEnabled()) {
                switch(border.fillType()) {
                    case 0:
                        var colorValue = color.description()
                        if ([colorValue isEqual: border.color().description()]) {[styleLayerIDs addObject: layerStyle.objectID()] ; continue layerStyleLoop}
                        break
                    case 1:
                        if (type == "gradient") {
                            var colorGradient = color.CSSAttributeStringWithMasterAlpha(1)
                            var borderGradient = border.gradient().CSSAttributeStringWithMasterAlpha(1)
                            if ([colorGradient isEqual: borderGradient]) {[styleLayerIDs addObject: layerStyle.objectID()] ; continue layerStyleLoop}
                        }
                        break
                    default: break
                }
            }
        }
        
        // All enabled shadow colors
        for (var l = 0; l < shadows.count(); l++) {
            var shadow = shadows[l]
            if (shadow.isEnabled()) {
                var colorValue = color.description()
                if ([colorValue isEqual: shadow.color().description()]) {[styleLayerIDs addObject: layerStyle.objectID()] ; continue layerStyleLoop}
            }
        }
        
        // All enabled innerShadow colors
        for (var m = 0; m < innerShadows.count(); m++) {
            var innerShadow = innerShadows[m]
            if (innerShadow.isEnabled()) {
                var colorValue = color.description()
                if ([colorValue isEqual: innerShadow.color().description()]) {[styleLayerIDs addObject: layerStyle.objectID()] ; continue layerStyleLoop}
            }
        }
    }
    
    // Text Styles
    var textArtboardPredicate = NSPredicate.predicateWithFormat("name == %@", "Text Styles")
    var textStyleArtboard = doc.currentPage().artboards().filteredArrayUsingPredicate(textArtboardPredicate).firstObject()
    var textPredicate = NSPredicate.predicateWithFormat("class == %@", MSTextLayer)
    var textStyles = textStyleArtboard.layers().filteredArrayUsingPredicate(textPredicate)
    
    textStyleLoop:
    for (var n = 0; n < textStyles.length; n++) {
        var textStyle = textStyles[n]
        
        // Check text color
        var textAttributes = textStyle.style().textStyle().attributes()
        var textNsColor = textAttributes.MSAttributedStringColorAttribute
        var textColor = MSColor.colorWithRed_green_blue_alpha(textNsColor.red(), textNsColor.green(), textNsColor.blue(), textNsColor.alpha())
        
        if (type == "color" && textColorIsEqual(textColor, color)) {[styleLayerIDs addObject: textStyle.objectID()] ; continue textStyleLoop}
        
        var fills = textStyle.style().fills()
        var borders = textStyle.style().borders()
        var shadows = textStyle.style().shadows()
        var innerShadows = textStyle.style().innerShadows()
        
        // Check all enabled fill colors
        for (var o = 0; o < fills.count(); o++) {
            var fill = fills[o]
            if (fill.isEnabled()) {
                switch(fill.fillType()) {
                    case 0:
                        var colorValue = color.description()
                        if ([colorValue isEqual: fill.color().description()]) {[styleLayerIDs addObject: textStyle.objectID()] ; continue textStyleLoop}
                        break
                    case 1:
                        if (type == "gradient") {
                            var colorGradient = color.CSSAttributeStringWithMasterAlpha(1)
                            var fillGradient = fill.gradient().CSSAttributeStringWithMasterAlpha(1)
                            if ([colorGradient isEqual: fillGradient]) {[styleLayerIDs addObject: textStyle.objectID()] ; continue textStyleLoop}
                        }
                        break
                    case 4:
                        if ([color isEqual: fill.image()]) {[styleLayerIDs addObject: textStyle.objectID()] ; continue textStyleLoop}
                        break
                    default: print("Noise Fill") ; break
                }
            }
        }
        
        // Check all enabled border colors
        for (var p = 0; p < borders.count(); p++) {
            var border = borders[p]
            if (border.isEnabled()) {
                switch(border.fillType()) {
                    case 0:
                        var colorValue = color.description()
                        if ([colorValue isEqual: border.color().description()]) {[styleLayerIDs addObject: textStyle.objectID()] ; continue textStyleLoop}
                        break
                    case 1:
                        if (type == "gradient") {
                            var colorGradient = color.CSSAttributeStringWithMasterAlpha(1)
                            var borderGradient = border.gradient().CSSAttributeStringWithMasterAlpha(1)
                            if ([colorGradient isEqual: borderGradient]) {[styleLayerIDs addObject: textStyle.objectID()] ; continue textStyleLoop}
                        }
                        break
                    default: break
                }
            }
        }
        
        // Check all enabled shadow colors
        for (var q = 0; q < shadows.count(); q++) {
            var shadow = shadows[q]
            if (shadow.isEnabled()) {
                var colorValue = color.description()
                if ([colorValue isEqual: shadow.color().description()]) {[styleLayerIDs addObject: textStyle.objectID()] ; continue textStyleLoop}
            }
        }
        
        // Check all enabled innerShadow colors
        for (var r = 0; r < innerShadows.count(); r++) {
            var innerShadow = innerShadows[r]
            if (innerShadow.isEnabled()) {
                var colorValue = color.description()
                if ([colorValue isEqual: innerShadow.color().description()]) {[styleLayerIDs addObject: textStyle.objectID()] ; continue textStyleLoop}
            }
        }
    }
    
    // jump to layer, select layer
    var styleGuidePage = NSPredicate.predicateWithFormat("name == %@", "Style Guide")
    var layerPredicate = NSPredicate.predicateWithFormat("objectID == %@", styleLayerIDs[0])
    var firstStyleLayer = searchLayersInsideArtboards(doc, styleGuidePage, layerPredicate).firstObject()
    firstStyleLayer.select_byExpandingSelection(true, false)
    sketchAction.centerSelection(doc)
    var json = {
        "info" : layer.name(),
        "styleLayerIDs" : styleLayerIDs,
        "lastIndex" : 0
    }
    saveJson_findGuideline(json)
    showStyleMessage(doc, json)
}
function startCycleFont(doc, layer) {
    var styleLayerIDs = NSMutableArray.array()
    var fontInfo = extractFontInfo(layer).name
    var predicate = NSPredicate.predicateWithFormat("name == %@", "Text Styles")
    var textStyleArtboard = doc.currentPage().artboards().filteredArrayUsingPredicate(predicate).firstObject()
    var textPredicate = NSPredicate.predicateWithFormat("class == %@", MSTextLayer)
    var textStyles = textStyleArtboard.layers().filteredArrayUsingPredicate(textPredicate)
    for (var i = 0; i < textStyles.length; i++) {
        var textStyle = textStyles[i]
        var styleInfo = extractFontInfo(textStyle).name
        if (fontInfo == styleInfo) {[styleLayerIDs addObject: textStyle.objectID()]}
    }
    // jump to layer, select layer
    var styleGuidePage = NSPredicate.predicateWithFormat("name == %@", "Style Guide")
    var layerPredicate = NSPredicate.predicateWithFormat("objectID == %@", styleLayerIDs[0])
    var firstStyleLayer = searchLayersInsideArtboards(doc, styleGuidePage, layerPredicate).firstObject()
    firstStyleLayer.select_byExpandingSelection(true, false)
    sketchAction.centerSelection(doc)
    var json = {
        "info" : fontInfo,
        "styleLayerIDs" : styleLayerIDs,
        "lastIndex" : 0
    }
    saveJson_findGuideline(json)
    showStyleMessage(doc, json)
}
function nextColorFontByJson(doc) {
    var json = getJson_findGuideline()
    var styleLayerIDs = json.styleLayerIDs
    var lastIndex = json.lastIndex
    var nextIndex = (lastIndex + 1 > styleLayerIDs.length - 1) ? 0 : lastIndex + 1
    var styleLayerID = json.styleLayerIDs[nextIndex]
    
    // jump to layer, select layer
    var styleGuidePage = NSPredicate.predicateWithFormat("name == %@", "Style Guide")
    var layerPredicate = NSPredicate.predicateWithFormat("objectID == %@", styleLayerID)
    var styleLayer = searchLayersInsideArtboards(doc, styleGuidePage, layerPredicate).firstObject()
    styleLayer.select_byExpandingSelection(true, false)
    sketchAction.centerSelection(doc)
    json.lastIndex = nextIndex
    saveJson_findGuideline(json)
    showStyleMessage(doc, json)
}
function showStyleMessage(doc, json) {
    var info = json.info
    var lastIndex = json.lastIndex
    var total = json.styleLayerIDs.length
    if (lastIndex == total - 1) {[[NSSound soundNamed:@"Funk"] play]}
    doc.showMessage(info + "  " + (lastIndex + 1) + "/" + total)
}

// MARK: - Find Instance
function startFindInstance(context) {
    var doc = context.document
    var menu = ["Normal Pages", "Symbol Page"]
    
    // Find symbol or shared style
    if (context.selection.length != 1) {showAlert("Fail to find instance", "You should select 1 layer") ; return}
    var layer = context.selection[0]
    var type

    if (layer.class() == MSSymbolMaster || layer.class() == MSSymbolInstance) {
        // Drop down menu
        var option = createDropdown("Find symbol's instance in", menu, 0)
        if (option.responseCode == 1001) {return}
        logArtboardIDDicFromSymbolID(doc, layer.symbolID(), option.index == 0)
        type = "Symbol"
    } else {
        if (layer.class() != MSShapeGroup && layer.class() != MSTextLayer) {
            showAlert("Fail to find instance", "You should select a symbol or layer with shared style")
            return
        }
        var sharedID = layer.style().sharedObjectID()
        if (sharedID == nil) {
            showAlert("Fail to find instance", "This layer doesn't have shared style")
            return
        }
        // Drop down menu
        var option = createDropdown("Find shared style's instance in", menu, 0)
        if (option.responseCode == 1001) {return}
        logArtboardIDDicFromSharedID(doc, sharedID, option.index == 0)
        type = "Shared Style"
    }

    var artboardIDs = artboardIDDic.allKeys()
    if (artboardIDs.length == 0) {
        showAlert("Fail to find instance", "This " + type.toLowerCase() + " doesn't have any instances")
        return
    }

    // Jump to the artboard
    var layerPredicate = NSPredicate.predicateWithFormat("objectID == %@", artboardIDs[0])
    var artboard = searchArtboards(doc, nil, layerPredicate).firstObject()
    jumpToArtboard(doc, artboard)

    // Create Json
    var json = {
        "type" : type,
        "artboardIDDic" : artboardIDDic,
        "artboardIDs" : artboardIDs,
        "lastArtboardIndex" : 0,
        "lastInstanceIndex" : -1
    }
    saveJson_findInstance(json)
    showInstanceMessage(doc, json)
}
function previousArtboard(context) {
    artboardByJson_goNext(context, false)
}
function nextArtboard(context) {
    artboardByJson_goNext(context, true)
}
function instanceInArtboardByJson(context) {
    var doc = context.document
    var json = getJson_findInstance()
    var artboardID = json.artboardIDs[json.lastArtboardIndex]
    var instanceIDs = json.artboardIDDic.objectForKey(artboardID)
    var lastIndex = json.lastInstanceIndex
    var currentIndex = (lastIndex + 1 > instanceIDs.length - 1) ? 0 : lastIndex + 1

    var predicate = NSPredicate.predicateWithFormat("objectID == %@", instanceIDs[currentIndex])
    var instance = searchLayersInsideArtboards(doc, nil, predicate).firstObject()

    instance.select_byExpandingSelection(true, false)
    json.lastInstanceIndex = currentIndex
    saveJson_findInstance(json)
    if (currentIndex == instanceIDs.length - 1) {[[NSSound soundNamed:@"Funk"] play]}
    doc.showMessage((currentIndex + 1) + "/" + instanceIDs.length)
}

// MARK: Helper Methods
function logArtboardIDDicFromSharedID(doc, sharedID, inNormalPages) {
    var targetPage
    if (inNormalPages) {
        targetPage = NSPredicate.predicateWithFormat("name != %@", "Style Guide")
    } else {
        targetPage = NSPredicate.predicateWithFormat("name == %@","Symbols")
    }
    var layerPredicate = NSPredicate.predicateWithFormat("style.sharedObjectID == %@", sharedID)
    var layers = searchLayersInsideArtboards(doc, targetPage, layerPredicate)

    for (var i = 0; i < layers.length; i++) {
        var layer = layers[i]
        var artboard = layer.parentArtboard()
        if (artboard.class() == MSSymbolMaster) {
            if (!inNormalPages) {logArtboardIDDic(artboard.objectID(), layer.objectID())}
            logArtboardIDDicFromSymbolID(doc, artboard.symbolID(), inNormalPages)
        } else {
            logArtboardIDDic(artboard.objectID(), layer.objectID())
        }
    }
}
function artboardByJson_goNext(context, goNext) {
    var doc = context.document
    var json = getJson_findInstance()
    var lastIndex = json.lastArtboardIndex
    var artboardIDs = json.artboardIDs
    var currentIndex

    if (goNext) {
        currentIndex = (lastIndex + 1 > artboardIDs.length - 1) ? 0 : lastIndex + 1
    } else {
        currentIndex = (lastIndex - 1 < 0) ? artboardIDs.length - 1 : lastIndex - 1
    }

    var predicate = NSPredicate.predicateWithFormat("objectID == %@", artboardIDs[currentIndex])
    var artboard = searchArtboards(doc, nil, predicate).firstObject()
    jumpToArtboard(doc, artboard)

    json.lastArtboardIndex = currentIndex
    json.lastInstanceIndex = -1
    saveJson_findInstance(json)
    showInstanceMessage(doc, json)
}
function showInstanceMessage(doc, json) {
    var type = json.type
    var lastIndex = json.lastArtboardIndex
    var total = json.artboardIDs.length
    if (lastIndex == total - 1) {[[NSSound soundNamed:@"Funk"] play]}
    doc.showMessage(type + " Instance's Artboard " + (lastIndex + 1) + "/" + total)
}

// MARK: Symbol
function logArtboardIDDicFromSymbolID(doc, symbolID, inNormalPages) {
    var targetPage
    if (inNormalPages) {
        targetPage = NSPredicate.predicateWithFormat("name != %@ && name != %@","Symbols", "Style Guide")
    } else {
        targetPage = NSPredicate.predicateWithFormat("name == %@","Symbols")
    }
    var predicate = NSPredicate.predicateWithFormat("class == %@", MSSymbolInstance)
    var targetInstances = searchLayersInsideArtboards(doc, targetPage, predicate)

    // NormalInstance
    for (var i = 0; i < targetInstances.count(); i++) {
        extractSymbolIDsFromInstance(doc, targetInstances[i], nil)
        logArtboardIDDicIfInstanceContainsTheSymbolID(targetInstances[i], symbolID)
        [instanceSymbolDic removeAllObjects]
        [instanceSymbolIDs removeAllObjects]
    }
}
function extractSymbolIDsFromInstance(doc, instance, parentDic) {
    var symbolDic = [NSMutableDictionary new]
    
    // Log dic for every symbol masterInstance
    var masterInstances = getMasterInstances(doc, instance.symbolID())
    var passedDic = (parentDic != nil) ? parentDic : [NSMutableDictionary new]
    for (var i = 0; i < masterInstances.count(); i++) {
        [symbolDic setObject: passedDic forKey: masterInstances[i].objectID()]
    }
    
    // Log overrides
    var overrides = instance.overrides()
    if (overrides != nil) {
        symbolDic = logOverrides(overrides, symbolDic, nil)
    }
    
    // Log symbolDic to instanceSymbolDic
    for (key in symbolDic) {[instanceSymbolDic setObject:symbolDic[key] forKey: key]}
    
    // Log symbolID & probe into masterInstances
    [instanceSymbolIDs addObject: instance.symbolID()]
    probeIntoMasterInstances(doc, masterInstances, nil)
}
// Will return multiple times, but will accumulate the result and get the final one
// We use parentKey to create branch, preventing duplicate objectIDs from been overriden
function logOverrides(overridesDic, resultDic, parentKey) {
    var localResultDic = resultDic
    for (key in overridesDic) {
        var value = overridesDic[key]
        if ([value isKindOfClass:[NSDictionary class]]) {
            var symbolID = value.objectForKey("symbolID")
            var myKey = (parentKey == nil) ? key : parentKey
            var myDic = localResultDic.objectForKey(myKey)
            // myDic != nil: only log when exist a symbol masterInstance
            if (symbolID != nil && myDic != nil) {
                // new dic to prevent variable reference problem
                var newDic = [NSMutableDictionary new]
                for (aKey in myDic) {[newDic setObject: myDic[aKey] forKey: aKey]}
                // Log key only if there is no such key (In order to respect ancestors' rules)
                if (newDic.objectForKey(key) == nil) {
                    [newDic setObject: symbolID forKey: key]
                    [localResultDic setObject: newDic forKey: myKey]
                }
            }
            // Keep diving if symbol isn't overriden to None
            if (symbolID != "") {logOverrides(value, localResultDic, myKey)}
        }
    }
    return localResultDic
}
function probeIntoMasterInstances(doc, masterInstances, parentDic) {
    for (var i = 0; i < masterInstances.count(); i++) {
        var masterInstance = masterInstances[i]
        var myDic = (parentDic == nil) ? instanceSymbolDic.objectForKey(masterInstance.objectID()) : parentDic
        var pairSymbolID = myDic.objectForKey(masterInstance.objectID())
        
        if (pairSymbolID != nil && pairSymbolID != masterInstance.symbolID()) {
            // Change direction (won't go deeper if symbolID is empty string)
            if (pairSymbolID != "") {
                [instanceSymbolIDs addObject: pairSymbolID]
                probeIntoMasterInstances(doc, getMasterInstances(doc, pairSymbolID), myDic)
            }
        } else {
            extractSymbolIDsFromInstance(doc, masterInstance, myDic)
        }
    }
}
function getMasterInstances(doc, symbolID) {
    var symbolPage = NSPredicate.predicateWithFormat("name == %@","Symbols")
    var predicate = NSPredicate.predicateWithFormat("symbolID == %@", symbolID)
    var master = searchArtboards(doc, symbolPage, predicate).firstObject()
    
    // master may be null (overrides's master been deleted)
    if (master != nil) {
        var masterInstancesPredicate = NSPredicate.predicateWithFormat("class == %@", MSSymbolInstance)
        return master.children().filteredArrayUsingPredicate(masterInstancesPredicate)
    } else {
        return NSArray.array()
    }
}
function logArtboardIDDicIfInstanceContainsTheSymbolID(instance, symbolID) {
    if ([instanceSymbolIDs containsObject: symbolID]) {
        var artboardID = instance.parentArtboard().objectID()
        logArtboardIDDic(artboardID, instance.objectID())
    }
}
function logArtboardIDDic(artboardID, instanceID) {
    var allArboardIDs = artboardIDDic.allKeys()
    if ([allArboardIDs containsObject: artboardID]) {
        var instanceIDs = artboardIDDic.objectForKey(artboardID)
        // Prevent duplicate style instanceID
        if ([instanceIDs containsObject: instanceID] == false) {[instanceIDs addObject: instanceID]}
        [artboardIDDic setObject: instanceIDs forKey: artboardID]
    } else {
        var instanceIDs = NSMutableArray.array()
        [instanceIDs addObject: instanceID]
        [artboardIDDic setObject: instanceIDs forKey: artboardID]
    }
}

// MARK: Json
function saveJson_findInstance(json) {
    var folderPath = createTempFolderNamed("SketchPro")
    var filePath = folderPath + "/findInstance.json"
    saveJsonToFile(json, filePath)
}
function getJson_findInstance() {
    var folderPath = getTempFolderPath("SketchPro")
    var filePath = folderPath + "/findInstance.json"
    return jsonFromFile(filePath, true)
}
function saveJson_findGuideline(json) {
    var folderPath = createTempFolderNamed("SketchPro")
    var filePath = folderPath + "/findGuideline.json"
    saveJsonToFile(json, filePath)
}
function getJson_findGuideline() {
    var folderPath = getTempFolderPath("SketchPro")
    var filePath = folderPath + "/findGuideline.json"
    return jsonFromFile(filePath, true)
}
