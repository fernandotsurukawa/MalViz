function applicationManager(globalData) {
    var arcSelect;
    var operationShown = [];
    var [minStep, maxStep] = d3.extent(globalData, d => d.Step);
    var svgActionWidth;
    //var initStamp, maxStamp;
    var leftBound, rightBound;

    var lensingMultiple = 10, granularity = 500;
    var initTimeStamp = d3.min(globalData, function (d) {
        return d.currenttimestamp;
    });
    var minTimeStamp = ~~(initTimeStamp / 100000) * 100000;

    var maxTimeStamp = d3.max(globalData, function (d) {
        return d.currenttimestamp;
    });

    var settings = {
        ProcessArea: {
            svg_height: 200,
            left: 150,
            bar_height: 35,
            scale_xMin: 10,
            scale_xMax: 800
        },
        MatrixArea: {
            padding: 1,
            row_text_width: 250,
            minValue: 5,
            rect_width: 15,
            rect_height: 15
        }
    };
    var globalmatrix, globalib, globalgroupbyprocessname;
    var getData = DataRetrieval(globalData);
    var global_links = ExtractGraph(globalData).links;

    function ExtractGraph(globalData) {
        var graphs = {
            links: [],
            sources: [],
            targets: []
        };
        //Update links
        globalData.forEach(function (object) {
            if (object.hasOwnProperty('library')) {
                //Check if source and target are in nodes
                var flag = false;
                graphs.links.forEach(function (link) {
                    if (link.source == object.Process_Name.toUpperCase() && link.target == object.library.toUpperCase()) {
                        flag = true;
                        //Update existing link
                        link.value.push(object);
                    }
                });
                if (!flag) {
                    var obj = new Object();
                    obj.source = object.Process_Name.toUpperCase();
                    obj.target = object.library.toUpperCase();
                    obj.value = [];
                    obj.value.push(object)
                    graphs.links.push(obj);
                }
            }
        });

        //Update node
        graphs.links.forEach(function (link) {
            var sourceFlag = false, targetFlag = false;
            graphs.sources.forEach(function (source) {
                if (source.name == link.source) {
                    sourceFlag = true; //Found
                    source.links.push(link.target)
                }

            });
            graphs.targets.forEach(function (target) {
                if (target.name == link.target) {
                    targetFlag = true;
                    target.links.push(link.source);
                }

            })

            if (!sourceFlag) {
                var obj = {};
                obj.name = link.source;
                obj.links = [];
                obj.links.push(link.target)
                obj.default = graphs.sources.length;
                graphs.sources.push(obj);
            }
            if (!targetFlag) {
                var obj = {};
                obj.name = link.target;
                obj.links = [];
                obj.links.push(link.source)
                obj.default = graphs.targets.length;
                graphs.targets.push(obj);
            }
        })
        return graphs;
    }

    function DataRetrieval(inputData) {
        var groupbyOperation = d3.nest().key(function (d) {
            return d.Operation;
        }).entries(inputData);

        var group_by_process_name = d3.nest().key(function (d) {
            return d.Process_Name;
        }).entries(inputData);

        var group_by_process = d3.nest().key(function (d) {
            return d.Process;
        }).entries(inputData);

        var getdatabydomain = (function () {
            var domains = {};
            inputData.forEach(function (t) {
                if (t.hasOwnProperty('Domain')) {
                    if (!domains.hasOwnProperty(t.Domain)) {
                        domains[t.Domain] = t;
                    }
                }
            });
            return domains;
        })();
        return {
            getdatabyOperation: groupbyOperation,
            getdatabyProcessName: group_by_process_name,
            getdatabyProcess: group_by_process,
            getdatabyDomain: getdatabydomain
        }
    }

    function getIndexByName(inputData, name) {
        var index;
        for (var i = 0; i < inputData.length; i++) {
            if (inputData[i].name == name) {
                index = i;
                break;
            }
        }
        return index;
    }

    function sortArrayByName(inputData) {
        return inputData.sort(function (a, b) {
            return d3.ascending(a.name, b.name)
        })
    }

    function sortArrayByValue(inputData, property) {
        return inputData.sort(function (a, b) {
            return b[property] - a[property];
        })
    }

    function sortArrayBySimilarity(source, target, inputData) {

        d3.select("#matrix2D").selectAll("*").remove();
        var processes1 = [];
        var processes2 = [];
        var processes3 = [];
        for (var i = 0; i < globalgroupbyprocessname.length; i++) {
            var obj = {};
            var obj2 = {};
            var obj3 = {};
            obj.name = globalgroupbyprocessname[i].key;
            obj.index = i;
            obj2.index = i;
            obj3.index = i;
            obj.refs = globalmatrix[i];
            var sumRefs = 0;
            var sumLibs = 0;
            for (var j = 0; j < obj.refs.length; j++) {
                if (obj.refs[j].value != 0) {
                    sumRefs += obj.refs[j].value.length;
                    sumLibs++;
                }
            }
            obj.sumRefs = sumRefs;
            obj.sumLibs = sumLibs;
            obj2.sumRefs = sumRefs;
            obj3.sumLibs = sumLibs;
            processes1.push(obj);
            processes2.push(obj2);
            processes3.push(obj3);
        }
        processes2.sort(function (a, b) {
            if (a.sumRefs < b.sumRefs) {
                return 1;
            }
            else
                return -1;
        });
        // Order processes3 by the total of libs
        processes3.sort(function (a, b) {
            if (a.sumLibs < b.sumLibs) {
                return 1;
            }
            else
                return -1;
        });


        // Copy the order from processes2 to processes
        for (var i = 0; i < processes2.length; i++) {
            var index = processes2[i].index;
            processes1[index].indexSumRefs = i;
        }
        // Copy the order from processes3 to processes
        for (var i = 0; i < processes3.length; i++) {
            var index = processes3[i].index;
            processes1[index].indexSumLibs = i;
        }

        function getRefCount(i, j) {
            if (globalmatrix[i][j].value != 0) {
                return globalmatrix[i][j].value.length;
            }
            else {
                return 0;
            }

        }

        function getDif(count1, count2) { // penalty function
            if (count1 == 0 && count2 != 0)
                return 1000;
            else if (count1 != 0 && count2 == 0)
                return 1000;
            else
                return Math.abs(count1 - count2);
        }

        function processDif(processArray, firstProcessIndex) {
            processArray[firstProcessIndex].isUsed = true;
            processArray[firstProcessIndex].indexSimilarity = 0;

            var startIndex = firstProcessIndex
            var count = 1;
            while (count < processArray.length) {
                var minDif = 100000000;
                var minIndex = -1;
                for (var i = 0; i < processArray.length; i++) {
                    if (processArray[i].isUsed == undefined) { // process is not ordered
                        // compute processes difference
                        var dif = 0;
                        for (var j = 0; j < globalib.length; j++) {
                            var count1 = getRefCount(startIndex, j);
                            var count2 = getRefCount(i, j);
                            dif += getDif(count1, count2); // Differential function *************
                        }
                        if (dif < minDif) {
                            minDif = dif;
                            minIndex = i;
                        }
                    }
                }
                if (minIndex >= 0) {
                    processArray[minIndex].isUsed = true;
                    processArray[minIndex].indexSimilarity = count;
                    startIndex = minIndex;
                }
                count++;
            }
            return processArray;
        }

        function processLib(libArray, firstLibIndex) {
            libArray[firstLibIndex].isUsed = true;
            libArray[firstLibIndex].indexSimilarity = 0;

            var startIndex = firstLibIndex
            var count = 1;
            while (count < libArray.length) {
                var minDif = 100000000;
                var minIndex = -1;
                for (var l = 0; l < libArray.length; l++) {
                    if (libArray[l].isUsed == undefined) { // process is not ordered
                        // compute libs difference
                        var dif = 0;
                        for (var i = 0; i < processes1.length; i++) {
                            var count1 = getRefCount(i, startIndex);
                            var count2 = getRefCount(i, l);
                            dif += getDif(count1, count2); // Differential function *************
                        }
                        if (dif < minDif) {
                            minDif = dif;
                            minIndex = l;
                        }
                    }
                }
                if (minIndex >= 0) {
                    libArray[minIndex].isUsed = true;
                    libArray[minIndex].indexSimilarity = count;
                    startIndex = minIndex;
                }
                count++;
            }
            return libArray;
        }

        var libs = [];
        var libs2 = [];
        for (var l = 0; l < globalib.length; l++) {
            var obj = {};
            var obj2 = {};
            obj.name = globalib[l];
            obj.index = l;
            obj2.index = l;
            var sumRefs = 0;
            for (var i = 0; i < processes1.length; i++) {
                if (globalmatrix[i][l].value != 0) {
                    sumRefs += globalmatrix[i][l].value.length;
                }
            }
            obj.sumRefs = sumRefs;
            obj2.sumRefs = sumRefs;
            libs.push(obj);
            libs2.push(obj2);
        }
        // Order libs2 by the total of references
        libs2.sort(function (a, b) {
            if (a.sumRefs < b.sumRefs) {
                return 1;
            }
            else
                return -1;
        });
        // Copy the order from libs2 to processes
        for (var i = 0; i < libs2.length; i++) {
            var index = libs2[i].index;
            libs[index].indexSumRefs = i;
        }
        //var processes1 = processDif(processes1,processes3[0].index);
        processes1 = processDif(processes1, 0);
        libs = processLib(libs, 0);

        // Order options
        var orderOption = 2;

        function getProcessIndex(index) {  // order of process in row of the matrix
            var newIndex;
            if (orderOption == 0) {// default order of processes
                newIndex = index;
            }
            else if (orderOption == 1) {// order by the total lib references
                newIndex = processes1[index].indexSumRefs;
            }
            else {
                newIndex = processes1[index].indexSimilarity;
            }
            return newIndex;
        }

        function getLibIndex(index) {  // order of process in column of the matrix
            var newIndex;
            if (orderOption == 0) {// default order of processes
                newIndex = index;
            }
            else if (orderOption == 1) {// order by the total lib references
                newIndex = libs[index].indexSumRefs;
            }
            else {
                newIndex = libs[index].indexSimilarity;
            }
            return newIndex;
        }

    }

    function sortArrayByLinkSize(inputData) {
        return inputData.sort(function (a, b) {
            return b.links.length - a.links.length;
        })
    }

    function sortArrayByCountSize(inputData) {
        return inputData.sort(function (a, b) {
            var first_value = d3.max(a.links, function (d) {
                return d.values.length;
            });
            var second_value = d3.max(b.links, function (d) {
                return d.values.length;
            });
            return second_value - first_value;
        })
    }

    function create2DMatrix(rows, cols, links) {
        //Initialize 2D matrix with size rows x columns
        var matrix = new Array(rows);
        for (var i = 0; i < rows; i++) {
            matrix[i] = new Array(cols);
            //  matrix[i].fill(new Array(0));
        }
        links.forEach(function (link) {
            matrix[link.source][link.target] = link.value;
        });
        return matrix;
    }

    function drawMatrix(rowLabel, colLabel, inputData, position) {
        d3.select(position).selectAll("*").remove();
        var margintop = 10;
        var ColorScale = d3.scaleLinear()
            .domain([0, Math.sqrt(250)])
            .range([0, 1]);
        var svg_height = rowLabel.length * (settings.MatrixArea.rect_height + settings.MatrixArea.padding) + 360;
        var svg_width = colLabel.length * (settings.MatrixArea.rect_width + settings.MatrixArea.padding) + settings.MatrixArea.row_text_width + 20;
        var svgMatrix = d3.select(position)
            .append('svg')
            .attr('height', svg_height)
            .attr('width', svg_width);
        var svg_g = svgMatrix.append('g').attr('transform', 'translate(0,10)');

        //Draw x labels
        var textGroup = svg_g.append('g').attr('transform', 'translate(' + (settings.MatrixArea.row_text_width + 10) + ',' + (rowLabel.length * (settings.MatrixArea.rect_height + settings.MatrixArea.padding) + 5) + ')')
        var cols = textGroup.selectAll('text').data(colLabel)
            .enter()
            .append('text')
            .attr('x', function (d, i) {
                return (i) * (settings.MatrixArea.rect_width + settings.MatrixArea.padding);
            })
            .text(function (d) {
                return d.name;
            })
            .attr("class", function (d, i) {
                return "colLabel mono c" + i;
            })
            .attr('transform', function (d, i) {
                return 'rotate(90 ' + i * (settings.MatrixArea.rect_width + settings.MatrixArea.padding) + ',0)';
            });

        //Draw y labels

        var rows = svg_g.append('g');
        var horitext = rows.selectAll('text')
            .data(rowLabel).enter().append('text')
            .text(function (d) {
                return d.name + " (" + d.links.length + ")";
            })
            .attr("class", function (d, i) {
                return "rowLabel mono r" + i;
            })
            .attr('x', settings.MatrixArea.row_text_width)
            .attr('y', function (d, i) {
                return i * (settings.MatrixArea.rect_height + settings.MatrixArea.padding) + settings.MatrixArea.rect_height / 2;
            }).attr('text-anchor', 'end');

        //Draw matrix
        inputData.forEach(function (row, index) {
            var group = svg_g.append('g') //draw container for cells
                .attr('class', 'row')
                .attr('height', settings.MatrixArea.rect_height + settings.MatrixArea.padding)
                .attr('transform', 'translate(' + (settings.MatrixArea.row_text_width + 10) + ',' + (index * (settings.MatrixArea.rect_height + settings.MatrixArea.padding)) + ')')
            //Draw cells

            var cells = group.selectAll('rect')
                .data(row)
                .enter()
                .append('rect')
                .attr("class", 'mat_rect')
                .attr('width', settings.MatrixArea.rect_width)
                .attr('height', settings.MatrixArea.rect_height)
                .attr('x', function (d, i) {
                    return i * (settings.MatrixArea.rect_width + settings.MatrixArea.padding);
                })
                .attr('fill', function (d) {
                    if (d == undefined) return 'white';
                    else return d3.interpolateGreys(ColorScale(Math.sqrt(d.length)))
                    // return d.length==0 ? 'white' : d3.interpolateGreys(ColorScale(Math.sqrt(d.length)));
                }).on('mouseenter', function (d, i) {
                    if (d == undefined) return;
                    d3.selectAll('text.rowLabel').attr('opacity', 0.2);
                    d3.selectAll('text.colLabel').attr('opacity', 0.2);
                    d3.select('text.r' + index).attr('opacity', 1);
                    d3.select('text.c' + i).attr('opacity', 1);
                    div.transition()
                        .duration(200)
                        .style("opacity", 1);
                    var text = "";
                    d.forEach(function (value) {
                        text += "Time: " + value.Timestamp + "&nbsp; Lib: " + value.library + "<br>"
                    })
                    div.html("<b>Number of calls: " + d.length + "</b><p>" + text)
                        .style("width", "300px")
                        .style("left", (d3.event.pageX) + 20 + "px")
                        .style("top", (d3.event.pageY) + "px");
                }).on('mouseleave', function (d, i) {
                    d3.selectAll('text.rowLabel').attr('opacity', 1);
                    d3.selectAll('text.colLabel').attr('opacity', 1);
                    div.transition()
                        .duration(200)
                        .style("opacity", 0);
                });
        })
    }

    function createNodesFromLinks(links) {
        var nodes = {sources: [], targets: []};
        links.forEach(function (link) {
            var sourceFlag = false, targetFlag = false;
            nodes.sources.forEach(function (source) {
                if (source.name == link.source) {
                    sourceFlag = true; //Found
                    source.links.push({target: link.target, values: link.value})
                }

            });
            nodes.targets.forEach(function (target) {
                if (target.name == link.target) {
                    targetFlag = true;
                    target.links.push({target: link.source, values: link.value});
                }

            })


            if (!sourceFlag) {
                var obj = {};
                obj.name = link.source;
                obj.links = [];
                obj.links.push({target: link.target, values: link.value})
                obj.default = nodes.sources.length;
                nodes.sources.push(obj);
            }
            if (!targetFlag) {
                var obj = {};
                obj.name = link.target;
                obj.links = [];
                obj.links.push({target: link.source, values: link.value})
                obj.default = nodes.targets.length;
                nodes.targets.push(obj);
            }
        });
        return nodes;
    }

    function loadMatrix(input_links) {

        var ColorScale = d3.scaleLinear()
            .domain([0, Math.sqrt(250)])
            .range([0, 1]);


        var local_links = JSON.parse(JSON.stringify(input_links));
        var nodes = createNodesFromLinks(local_links);
        local_links.forEach(function (link) {
            link.source = getIndexByName(nodes.sources, link.source);
            link.target = getIndexByName(nodes.targets, link.target);
        });

        // var matrix = create2DMatrix(nodes.sources.length, nodes.targets.length, local_links);
        var margin = {
                top: 400,
                right: 0,
                bottom: 0,
                left: 250
            },
            width = 1100,
            height = 250;
        var svg = d3.select("#matrix2D").append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        var matrix = [];
        var x_length = nodes.targets.length;
        var y_length = nodes.sources.length;
        var x_scale = d3.scaleBand().range([0, width]).domain(d3.range(x_length));
        var y_scale = d3.scaleBand().range([0, height]).domain(d3.range(y_length));


        nodes.targets.forEach(function (node) {
            node.linkDiff = node.links.length;
            node.linkSize = d3.max(node.links, function (d) {
                return d.values.length;
            })
        });
        nodes.sources.forEach(function (node, i) {
            node.linkDiff = node.links.length;
            node.linkSize = d3.max(node.links, function (d) {
                return d.values.length;
            })
            matrix[i] = d3.range(x_length).map(function (j) {
                return {x: j, y: i, z: []};
            });
        });


        local_links.forEach(function (link) {
            matrix[link.source][link.target].z = link.value;
        });


        //Tommy's code
        var processes1 = [];
        var processes2 = [];
        var processes3 = [];
        for (var i = 0; i < y_length; i++) {
            var obj = {};
            var obj2 = {};
            var obj3 = {};
            obj.name = nodes.sources[i].name;
            obj.index = i;
            obj2.index = i;
            obj3.index = i;
            obj.refs = matrix[i];
            var sumRefs = 0;
            var sumLibs = 0;
            for (var j = 0; j < obj.refs.length; j++) {
                if (obj.refs[j].z.length != 0) {
                    sumRefs += obj.refs[j].z.length;
                    sumLibs++;
                }
            }
            obj.sumRefs = sumRefs;
            obj.sumLibs = sumLibs;
            obj2.sumRefs = sumRefs;
            obj3.sumLibs = sumLibs;
            processes1.push(obj);
            processes2.push(obj2);
            processes3.push(obj3);
        }

        // Order processes2 by the total of references
        processes2.sort(function (a, b) {
            if (a.sumRefs < b.sumRefs) {
                return 1;
            }
            else
                return -1;
        });
        // Order processes3 by the total of libs
        processes3.sort(function (a, b) {
            if (a.sumLibs < b.sumLibs) {
                return 1;
            }
            else
                return -1;
        });


        for (var i = 0; i < processes2.length; i++) {
            var index = processes2[i].index;
            processes1[index].indexSumRefs = i;
        }
        // Copy the order from processes3 to processes
        for (var i = 0; i < processes3.length; i++) {
            var index = processes3[i].index;
            processes1[index].indexSumLibs = i;
        }


        function getRefCount(i, j) {
            if (matrix[i][j].value != 0) {
                return matrix[i][j].z.length;
            }
            else {
                return 0;
            }

        }

        function getDif(count1, count2) { // penalty function
            if (count1 == 0 && count2 != 0)
                return 1000;
            else if (count1 != 0 && count2 == 0)
                return 1000;
            else
                return Math.abs(count1 - count2);
        }

        function processDif(processArray, firstProcessIndex) {
            processArray[firstProcessIndex].isUsed = true;
            processArray[firstProcessIndex].indexSimilarity = 0;

            var startIndex = firstProcessIndex
            var count = 1;
            while (count < processArray.length) {
                var minDif = 100000000;
                var minIndex = -1;
                for (var i = 0; i < processArray.length; i++) {
                    if (processArray[i].isUsed == undefined) { // process is not ordered
                        // compute processes difference
                        var dif = 0;
                        for (var j = 0; j < nodes.targets.length; j++) {
                            var count1 = getRefCount(startIndex, j);
                            var count2 = getRefCount(i, j);
                            dif += getDif(count1, count2); // Differential function *************
                        }
                        if (dif < minDif) {
                            minDif = dif;
                            minIndex = i;
                        }
                    }
                }
                if (minIndex >= 0) {
                    // console.log(minIndex + " " + processArray[minIndex].name);
                    processArray[minIndex].isUsed = true;
                    processArray[minIndex].indexSimilarity = count;
                    startIndex = minIndex;
                }
                count++;
            }
            return processArray;
        }

        function processLib(libArray, firstLibIndex) {
            libArray[firstLibIndex].isUsed = true;
            libArray[firstLibIndex].indexSimilarity = 0;

            var startIndex = firstLibIndex
            var count = 1;
            while (count < libArray.length) {
                var minDif = 100000000;
                var minIndex = -1;
                for (var l = 0; l < libArray.length; l++) {
                    if (libArray[l].isUsed == undefined) { // process is not ordered
                        // compute libs difference
                        var dif = 0;
                        for (var i = 0; i < processes1.length; i++) {
                            var count1 = getRefCount(i, startIndex);
                            var count2 = getRefCount(i, l);
                            dif += getDif(count1, count2); // Differential function *************
                        }
                        if (dif < minDif) {
                            minDif = dif;
                            minIndex = l;
                        }
                    }
                }
                if (minIndex >= 0) {
                    libArray[minIndex].isUsed = true;
                    libArray[minIndex].indexSimilarity = count;
                    startIndex = minIndex;
                }
                count++;
            }
            return libArray;
        }


        // Create a new array of libs
        var libs = [];
        var libs2 = [];
        for (var l = 0; l < nodes.targets.length; l++) {
            var obj = {};
            var obj2 = {};
            obj.name = nodes.targets[l];
            obj.index = l;
            obj2.index = l;
            var sumRefs = 0;
            for (var i = 0; i < processes1.length; i++) {
                if (matrix[i][l].value != 0) {
                    sumRefs += matrix[i][l].z.length;
                }
            }
            obj.sumRefs = sumRefs;
            obj2.sumRefs = sumRefs;
            libs.push(obj);
            libs2.push(obj2);
        }
        // Order libs2 by the total of references
        libs2.sort(function (a, b) {
            if (a.sumRefs < b.sumRefs) {
                return 1;
            }
            else
                return -1;
        });
        // Copy the order from libs2 to processes
        for (var i = 0; i < libs2.length; i++) {
            var index = libs2[i].index;
            libs[index].indexSumRefs = i;
        }
        //var processes1 = processDif(processes1,processes3[0].index);
        processes1 = processDif(processes1, 0);
        libs = processLib(libs, 0);

        // Order options

        nodes.sources.forEach(function (node, i) {
            node.similarity = processes1[i].indexSimilarity;
        });
        nodes.targets.forEach(function (node, i) {
            node.similarity = libs[i].indexSimilarity;
        });

        var orders = {
            process: d3.range(y_length).sort(function (a, b) {
                return d3.ascending(nodes.sources[a].name, nodes.sources[b].name);
            }),
            library: d3.range(x_length).sort(function (a, b) {
                return d3.ascending(nodes.targets[a].name, nodes.targets[b].name);
            }),
            y_count: d3.range(y_length).sort(function (a, b) {
                return d3.descending(nodes.sources[a].linkSize, nodes.sources[b].linkSize);
            }),
            x_count: d3.range(x_length).sort(function (a, b) {
                return d3.descending(nodes.targets[a].linkSize, nodes.targets[b].linkSize);
            }),
            y_diff: d3.range(y_length).sort(function (a, b) {
                return d3.descending(nodes.sources[a].linkDiff, nodes.sources[b].linkDiff);
            }),
            x_diff: d3.range(x_length).sort(function (a, b) {
                return d3.descending(nodes.targets[a].linkDiff, nodes.targets[b].linkDiff);
            }),
            y_similarity: d3.range(y_length).sort(function (a, b) {
                return d3.descending(nodes.sources[a].similarity, nodes.sources[b].similarity);
            }),
            x_similarity: d3.range(x_length).sort(function (a, b) {
                return d3.descending(nodes.targets[a].similarity, nodes.targets[b].similarity);
            })
        };

        x_scale.domain(orders.x_similarity);
        y_scale.domain(orders.y_similarity);
        var rows = svg.selectAll(".row")
            .data(matrix)
            .enter().append("g")
            .attr("class", "row")
            .attr("transform", function (d, i) {
                return "translate(0," + y_scale(i) + ")";
            })
            .each(row);
        // rows.append("line")
        //     .attr("x2", width);
        rows.append("text")
            .attr("x", -6)
            .attr("y", y_scale.bandwidth() / 2)
            .attr("dy", ".32em")
            .attr("text-anchor", "end")
            .text(function (d, i) {
                return capitalize_Words(nodes.sources[i].name);
            });
        var column = svg.selectAll(".column")
            .data(matrix[0])
            .enter().append("g")
            .attr("class", "column")
            .attr("transform", function (d, i) {
                return "translate(" + x_scale(i) + ")rotate(-90)";
            });
        // column.append("line")
        //     .attr("x1", -width);
        column.append("text")
            .attr("x", 6)
            .attr("y", x_scale.bandwidth() / 2)
            .attr("dy", ".32em")
            .attr("text-anchor", "start")
            .text(function (d, i) {
                return capitalize_Words(nodes.targets[i].name);
            });
        //drawMatrix(nodes.sources, nodes.targets, matrix, '#matrix2D');
        d3.select("#order").on("change", function () {
            clearTimeout(timeout);
            order(this.value);
        });
        var timeout = setTimeout(function () {
            order("group");
            d3.select("#order").property("selectedIndex", 0).node().focus();
        }, 2000);

        function order(value) {
            if (value == "name") {
                x_scale.domain(orders["library"]);
                y_scale.domain(orders["process"]);
            } else if (value == "frequency") {
                x_scale.domain(orders["x_count"]);
                y_scale.domain(orders["y_count"]);
            }
            else if (value == "linkDiff") {
                x_scale.domain(orders["x_diff"]);
                y_scale.domain(orders["y_diff"]);
            }
            else if (value == "similarity") {
                x_scale.domain(orders["x_similarity"]);
                y_scale.domain(orders["y_similarity"]);
            }


            // y_scale.domain(nodes.sources.sort(function (a, b) { return a.name -b.name }));
            var t = svg.transition().duration(2500);

            t.selectAll(".row")
                .delay(function (d, i) {
                    return y_scale(i) * 4;
                })
                .attr("transform", function (d, i) {
                    return "translate(0," + y_scale(i) + ")";
                })
                .selectAll(".cell")
                .delay(function (d) {
                    return x_scale(d.x) * 4;
                })
                .attr("x", function (d) {
                    return x_scale(d.x);
                });


            t.selectAll(".column")
                .delay(function (d, i) {
                    return x_scale(i) * 4;
                })
                .attr("transform", function (d, i) {
                    return "translate(" + x_scale(i) + ")rotate(-90)";
                });
        }

        function row(row) {
            var cell = d3.select(this).selectAll(".cell")
                .data(row.filter(function (d) {
                    return d.z;
                }))
                .enter().append("rect")
                .attr("class", "cell")
                .attr("x", function (d) {
                    return x_scale(d.x);
                })
                .attr("width", x_scale.bandwidth())
                .attr("height", y_scale.bandwidth())
                //.style("fill-opacity", function(d) { return z(d.z); })
                .style("fill", function (d) {
                    if (d == undefined) return 'white';
                    else return d3.interpolateGreys(ColorScale(Math.sqrt(d.z.length)))
                })
                .on("mouseover", mouseover)
                .on("mouseout", mouseout);
        }

        function capitalize_Words(str) {
            return str.replace(/\w\S*/g, function (txt) {
                return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
            });
        }

        function mouseover(p) {
            d3.selectAll(".row text").classed("active", function (d, i) {
                return i == p.y;
            });
            d3.selectAll(".column text").classed("active", function (d, i) {
                return i == p.x;
            });
            div.transition().duration(200).style("opacity", .9);
            var text = "";
            p.z.forEach(function (value) {
                text += "Time: " + value.Timestamp + "&nbsp; Lib: " + value.library + "<br>"
            })
            div.html("<b>Number of calls: " + p.z.length + "</b><p>" + text)
                .style("width", "300px")
                .style("left", (d3.event.pageX) + 20 + "px")
                .style("top", (d3.event.pageY) + "px");
        }

        function mouseout() {
            d3.selectAll("text").classed("active", false);
        }

        d3.select('#loading').remove();
    }

    function drawMatrixOld(matrix, lib, group_by_process_name) {
        var rect_width = 12,
            rect_height = 11,
            spacing = 2,
            svgheight = (rect_height + spacing) * matrix.length;
        var maxvalue = d3.max(matrix, function (d) {
            return d3.max(d, function (e) {
                return e.value.length;
            });
        });

        // Tommy 2018 ******************************************
        // Create a new array of process
        var processes1 = [];
        var processes2 = [];
        var processes3 = [];
        for (var i = 0; i < group_by_process_name.length; i++) {
            var obj = {};
            var obj2 = {};
            var obj3 = {};
            obj.name = group_by_process_name[i].key;
            obj.index = i;
            obj2.index = i;
            obj3.index = i;
            obj.refs = matrix[i];
            var sumRefs = 0;
            var sumLibs = 0;
            for (var j = 0; j < obj.refs.length; j++) {
                if (obj.refs[j].value != 0) {
                    sumRefs += obj.refs[j].value.length;
                    sumLibs++;
                }
            }
            obj.sumRefs = sumRefs;
            obj.sumLibs = sumLibs;
            obj2.sumRefs = sumRefs;
            obj3.sumLibs = sumLibs;
            processes1.push(obj);
            processes2.push(obj2);
            processes3.push(obj3);
        }

        // Order processes2 by the total of references
        processes2.sort(function (a, b) {
            if (a.sumRefs < b.sumRefs) {
                return 1;
            }
            else
                return -1;
        });
        // Order processes3 by the total of libs
        processes3.sort(function (a, b) {
            if (a.sumLibs < b.sumLibs) {
                return 1;
            }
            else
                return -1;
        });


        // Copy the order from processes2 to processes
        for (var i = 0; i < processes2.length; i++) {
            var index = processes2[i].index;
            processes1[index].indexSumRefs = i;
        }
        // Copy the order from processes3 to processes
        for (var i = 0; i < processes3.length; i++) {
            var index = processes3[i].index;
            processes1[index].indexSumLibs = i;
        }


        function getRefCount(i, j) {
            if (matrix[i][j].value != 0) {
                return matrix[i][j].value.length;
            }
            else {
                return 0;
            }

        }

        function getDif(count1, count2) { // penalty function
            if (count1 == 0 && count2 != 0)
                return 1000;
            else if (count1 != 0 && count2 == 0)
                return 1000;
            else
                return Math.abs(count1 - count2);
        }

        function processDif(processArray, firstProcessIndex) {
            processArray[firstProcessIndex].isUsed = true;
            processArray[firstProcessIndex].indexSimilarity = 0;

            var startIndex = firstProcessIndex
            var count = 1;
            while (count < processArray.length) {
                var minDif = 100000000;
                var minIndex = -1;
                for (var i = 0; i < processArray.length; i++) {
                    if (processArray[i].isUsed == undefined) { // process is not ordered
                        // compute processes difference
                        var dif = 0;
                        for (var j = 0; j < lib.length; j++) {
                            var count1 = getRefCount(startIndex, j);
                            var count2 = getRefCount(i, j);
                            dif += getDif(count1, count2); // Differential function *************
                        }
                        if (dif < minDif) {
                            minDif = dif;
                            minIndex = i;
                        }
                    }
                }
                if (minIndex >= 0) {
                    processArray[minIndex].isUsed = true;
                    processArray[minIndex].indexSimilarity = count;
                    startIndex = minIndex;
                }
                count++;
            }
            return processArray;
        }

        function processLib(libArray, firstLibIndex) {
            libArray[firstLibIndex].isUsed = true;
            libArray[firstLibIndex].indexSimilarity = 0;

            var startIndex = firstLibIndex
            var count = 1;
            while (count < libArray.length) {
                var minDif = 100000000;
                var minIndex = -1;
                for (var l = 0; l < libArray.length; l++) {
                    if (libArray[l].isUsed == undefined) { // process is not ordered
                        // compute libs difference
                        var dif = 0;
                        for (var i = 0; i < processes1.length; i++) {
                            var count1 = getRefCount(i, startIndex);
                            var count2 = getRefCount(i, l);
                            dif += getDif(count1, count2); // Differential function *************
                        }
                        if (dif < minDif) {
                            minDif = dif;
                            minIndex = l;
                        }
                    }
                }
                if (minIndex >= 0) {
                    libArray[minIndex].isUsed = true;
                    libArray[minIndex].indexSimilarity = count;
                    startIndex = minIndex;
                }
                count++;
            }
            return libArray;
        }


        // Create a new array of libs
        var libs = [];
        var libs2 = [];
        for (var l = 0; l < lib.length; l++) {
            var obj = {};
            var obj2 = {};
            obj.name = lib[l];
            obj.index = l;
            obj2.index = l;
            var sumRefs = 0;
            for (var i = 0; i < processes1.length; i++) {
                if (matrix[i][l].value != 0) {
                    sumRefs += matrix[i][l].value.length;
                }
            }
            obj.sumRefs = sumRefs;
            obj2.sumRefs = sumRefs;
            libs.push(obj);
            libs2.push(obj2);
        }
        // Order libs2 by the total of references
        libs2.sort(function (a, b) {
            if (a.sumRefs < b.sumRefs) {
                return 1;
            }
            else
                return -1;
        });
        // Copy the order from libs2 to processes
        for (var i = 0; i < libs2.length; i++) {
            var index = libs2[i].index;
            libs[index].indexSumRefs = i;
        }
        //var processes1 = processDif(processes1,processes3[0].index);
        processes1 = processDif(processes1, 0);
        libs = processLib(libs, 0);

        // Order options
        var orderOption = 2;

        function getProcessIndex(index) {  // order of process in row of the matrix
            var newIndex;
            if (orderOption == 0) {// default order of processes
                newIndex = index;
            }
            else if (orderOption == 1) {// order by the total lib references
                newIndex = processes1[index].indexSumRefs;
            }
            else {
                newIndex = processes1[index].indexSimilarity;
            }
            return newIndex;
        }

        function getLibIndex(index) {  // order of process in column of the matrix
            var newIndex;
            if (orderOption == 0) {// default order of processes
                newIndex = index;
            }
            else if (orderOption == 1) {// order by the total lib references
                newIndex = libs[index].indexSumRefs;
            }
            else {
                newIndex = libs[index].indexSimilarity;
            }
            return newIndex;
        }

        var ColorScale = d3.scaleLinear()
            .domain([0, Math.sqrt(maxvalue)])
            .range([0, 1]);
        var svgMatrix = d3.select('#matrix').append('svg').attr('height', svgheight).attr('width', "100%").attr('margin-top', "15px");
        matrix.forEach(function (row, index) {

            var group = svgMatrix.append('g').attr('height', 12).attr('transform', 'translate(200,' + getProcessIndex(index) * (rect_height + spacing) + ')')
            var rect = group.selectAll('rect')
                .data(row)
                .enter()
                .append('rect')
                .attr("class", 'mat_rect')
                .attr('width', rect_width)
                .attr('height', rect_height)
                .attr('x', function (d, i) {
                    return getLibIndex(i) * (rect_height + spacing);
                })
                .attr('fill', function (d) {
                    return d.value == 0 ? 'white' : d3.interpolateOrRd(ColorScale(Math.sqrt(d.value.length)));
                }).on('mouseenter', function (d, i) {
                    if (d.source == undefined) return;
                    // d3.selectAll('.mat_rect').classed('cell-hover',false);
                    d3.select(this).classed("cell-hover", true);

                    for (var r = 0; r < processes1.length; r++) {
                        if (r == index)
                            d3.selectAll(".rowLabel.mono.r" + r).style("opacity", 1);
                        else
                            d3.selectAll(".rowLabel.mono.r" + r).style("opacity", 0.2);
                        //  d3.selectAll(".colLabel.mono.c"+i).style("opacity", 1);;
                    }
                    for (var c = 0; c < libs.length; c++) {
                        if (c == i)
                            d3.selectAll(".colLabel.mono.c" + c).style("opacity", 1);
                        else
                            d3.selectAll(".colLabel.mono.c" + c).style("opacity", 0.2);
                    }

                    //
                    // svgMatrix.append('rect')
                    //     .attr('x',200+i*(rect_height+spacing))
                    //     .attr('width',rect_width)
                    //     .attr('height',svgheight - (rect_height+spacing)*(index+1))
                    //     .attr('class','highlight-bar').attr('y',(rect_height+spacing)*(index+1));
                    //
                    // svgMatrix.append('rect')
                    //     .attr('x',200)
                    //     .attr('width',function () {
                    //       return (i)*(rect_width+spacing);
                    //     })
                    //
                    //     .attr('height',rect_height)
                    //     .attr('class','highlight-bar')
                    //     .attr('y',index*(rect_height+spacing));
                    div.transition()
                    // .duration(200)
                        .style("opacity", 1);
                    var text = "";
                    d.value.forEach(function (value) {
                        text += "Time: " + value.Timestamp + "&nbsp; Lib: " + value.library + "<br>"
                    })
                    div.html("<b>Number of calls: " + d.value.length + "</b><p>" + text)
                        .style("width", "300px")
                        .style("left", (d3.event.pageX) + 20 + "px")
                        .style("top", (d3.event.pageY) + "px");

                })
                .on('mouseleave', function (d, i) {
                    d3.select(this).classed("cell-hover", false);
                    for (var r = 0; r < processes1.length; r++) {
                        d3.selectAll(".rowLabel.mono.r" + r).style("opacity", 1);
                    }
                    for (var c = 0; c < libs.length; c++) {
                        d3.selectAll(".colLabel.mono.c" + c).style("opacity", 1);
                    }
                });

        })
        //Draw text
        var textGroup = svgMatrix.append('g').attr('transform', 'translate(200,' + matrix.length * (rect_height + spacing) + ')')
        var text = textGroup.selectAll('text').data(lib).enter().append('text').attr('x', function (d, i) {
            return (i) * (rect_height + spacing);
        }).text(function (d) {
            return d;
        }).attr("class", function (d, i) {
            return "colLabel mono c" + i;
        })
            .attr('transform', function (d, i) {
                return 'rotate(45 ' + i * (rect_height + spacing) + ',0)';
            })

        var horizontalText = svgMatrix.append('g').attr('width', 200);
        var horitext = horizontalText.selectAll('text')
            .data(group_by_process_name).enter().append('text').text(function (d) {
                return d.key;
            })
            .attr("class", function (d, i) {
                return "rowLabel mono r" + i;
            })
            .attr('x', 190)
            .attr('y', function (d, i) {
                return getProcessIndex(i) * (rect_height + spacing) + rect_height / 2;
            }).attr('text-anchor', 'end');


    }

    return {
        // data stats - overview
        drawStats: function (position) {
            var allProcess = [];
            var margin_left = settings.ProcessArea.left;
            var bar_height = settings.ProcessArea.bar_height;
            var group_by_process = getData.getdatabyProcess;
            var group_by_operation = getData.getdatabyOperation;

            var operationShown = group_by_operation.map(d => d.key);
            // console.log(group_by_operation, operationShown);
            var firstClick, thisClass;
            var active = {};

            // group_by_operation.map(d => d.key).filter(d => d.Process !== "Profiling");

            var xScale = d3.scaleLinear()
                .domain([0, d3.max(group_by_process, function (d) {
                    return d.values.length;
                })])
                .range([settings.ProcessArea.scale_xMin, settings.ProcessArea.scale_xMax]);

            d3.select(position).selectAll("*").remove();
            var svgStats = d3.select(position).append('svg').attr("id", "overview").attr('width', '100%').attr('height', settings.ProcessArea.svg_height).attr("y", 0);


            group_by_process.forEach(function (process, index) {
                var group = svgStats.append('g').attr("transform", "translate(0," + index * bar_height + ")");
                var child_process = d3.nest().key(function (d) {
                    return d.Operation
                }).entries(process.values);

                child_process = child_process.sort(function (a, b) {
                    return b.values.length - a.values.length;
                });
                var xpos = margin_left;

                child_process.forEach(function (child) {
                    group.append('rect').attr('x', function (d) {
                        return xpos;
                    })
                        .attr('width', function (d) {
                            return xScale(child.values.length)
                        })
                        .attr('height', 30)
                        .attr('fill', function (d) {
                            return colorPicker(child.key);
                        })
                        .classed(child.key.replace(" ", ""), true)
                        .classed("op0", child.key === "Process Profiling")
                        .classed("op1", !(child.key === "Process Profiling"))

                        .on('mouseover', function () {
                            thisClass = d3.select(this).attr("class");
                            d3.select(this)
                                .classed("op2", true)
                                .classed("op0 op1", false);

                            divOperation.transition()
                                .duration(200)
                                .style("opacity", .9);
                            divOperation.html('Operation: ' + child.key + "<br/> Total calls: " + child.values.length.toLocaleString() + "<br/>")
                                .style("left", (d3.event.pageX) + 5 + "px")
                                .style("top", (d3.event.pageY - 28) + "px")
                                .style("pointer-events", "none")
                                .style("background-color", "#cccccc")
                                .style("padding", "5px");
                        })
                        .on('mouseleave', function (d) {
                            divOperation.style("opacity", 0);
                            d3.select(this)
                                .classed("op0 op1 op2", false)
                                .classed(thisClass, true)
                        })

                        .on("click", function (d) {
                            if (firstClick === undefined) {
                                firstClick = true;
                                var key1 = child.key.replace(" ", "");
                                // if profiling
                                // the only difference is: not disable all others
                                if (child.key.replace(" ", "") === "ProcessProfiling") {
                                    console.log("bingo");
                                    // show rect
                                    d3.select("#heatmap").selectAll('rect.' + key1)
                                        .style('visibility', "visible")
                                        .raise();

                                    // show arc
                                    arcSelect = d3.selectAll("[class*=o" + key1 + "]");
                                    arcSelect
                                        .classed("visible", !active[key1])
                                        .classed("hidden", !!active[key1])
                                        .raise();
                                    thisClass = d3.select(this).attr("class").split(" ")[0] + " op1";
                                }
                                else {
                                    // first, hide all
                                    // hide rect
                                    d3.select("#heatmap").selectAll('rect[group=detail]')
                                        .style('visibility', "hidden");

                                    // hide arc
                                    d3.selectAll(".arc")
                                        .classed("hidden", true);

                                    // unselect group
                                    svgStats.selectAll("rect")
                                        .classed("op0", true)
                                        .classed("op1 op2", false);

                                    // then, visible selection
                                    console.log(key1);
                                    //show rect
                                    d3.select("#heatmap").selectAll('rect.' + key1)
                                        .style('visibility', "visible")
                                        .raise();

                                    //show arc
                                    arcSelect = d3.selectAll("[class*=o" + key1 + "]");
                                    arcSelect
                                        .classed("visible", !active[key1])
                                        .classed("hidden", !!active[key1])
                                        .raise();

                                    d3.select(this)
                                        .classed("op1", true)
                                        .classed("op0 op2", false);
                                }
                                // change status
                                active[key1] = !active[key1];
                            }
                            else {
                                var key2 = child.key.replace(" ", "");
                                // second click
                                console.log(active[key2]);
                                // show group
                                d3.select(this)
                                    .classed("op1", () => {
                                        let option = active[key2] ? " op0" : " op1";
                                        thisClass = d3.select(this).attr("class").split(" ")[0] + option;
                                        return !active[key2];
                                    })
                                    .classed("op2", false)
                                    .classed("op0", !!active[key2]);

                                // show arc
                                d3.selectAll("[class*=o" + key2 + "]")
                                    .classed("visible", !active[key2])
                                    .classed("hidden", !!active[key2])
                                    .raise();

                                // show rect
                                d3.select("#heatmap").selectAll('rect.' + key2)
                                    .style('visibility', active[key2] ? "hidden" : "visible")
                                    .raise();

                                active[key2] = !active[key2];
                            }
                        });

                    xpos += xScale(child.values.length) + 2;
                });
                group.append('text').text(process.key + " (" + process.values.length + ")").attr('x', 0).attr('y', 18);
            });

            document.getElementById("opSelection").checked = operationShown.indexOf("Process Profiling") < 0;
        },

        // List of Operations (legend)
        drawStats2: function (position) {
            d3.select(position).selectAll("*").remove();
            var svgStats = d3.select(position).append('svg').attr('width', '100%').attr('height', 1110);
            var group_O = svgStats.append('g');

            var group_by_operation = d3.keys(list);
            group_by_operation.forEach(function (operation, index) {
                var rect = group_O.append('g').attr('transform', 'translate(0,' + index * 15 + ')');
                rect.append('rect').attr('width', '20px').attr('height', '12px').attr('fill', function (d) {
                    return colorPicker(operation);
                });
                rect.append('text').text(operation).attr('x', '30px').style('color', 'black').style('font-size', '12px').attr('y', '10px')
            })
        },
        loadMatrix: function () {
            return loadMatrix(global_links);
        },

        drawMain: function (position) {
            d3.select(position).selectAll("*").remove();
            var lines = [];
            var group_by_process_name = getData.getdatabyProcessName;
            var haveExeChild = [];
            var operationKeys = group_by_process_name.map(d => d.key);

            globalData.forEach(d => {
                for (var i = 0; i < operationKeys.length; i++) {
                    if (d.Path.endsWith("\\" + operationKeys[i])) {
                        haveExeChild.push(d);
                    }
                }
            });

            var updated_data = UpdateProcessNameWithChild(group_by_process_name, haveExeChild);

            for (var i = 0; i < updated_data.length; i++) {
                updated_data[i].children = [];
                for (var j = 0; j < updated_data[i].childs.length; j++) {
                    updated_data[i].children[j] = updated_data[updated_data[i].childs[j]];
                }

                // sort children
                updated_data[i].children.sort(function (a, b) {
                    if (a.childs.length < b.childs.length) {
                        return -1;
                    }
                    else if (a.childs.length > b.childs.length) {
                        return 1;
                    }
                    else {
                        if (a.values[0].Step < b.values[0].Step) {
                            return 1;
                        }
                        else if (a.values[0].Step > b.values[0].Step) {
                            return -1;
                        }
                        else
                            return 0;
                    }
                });
            }

            updated_data.sort(function (a, b) {
                if (getSuccessors(a, []).length < getSuccessors(b, []).length) {
                    return 1;
                }
                else if (getSuccessors(a, []).length > getSuccessors(b, []).length) {
                    return -1;
                }
                else {
                    if (a.values[0].Step < b.values[0].Step) {
                        return -1;
                    }
                    else if (a.values[0].Step > b.values[0].Step) {
                        return 1;
                    }
                    else
                        return 0;
                }
            });

            var orderedArray = [];

            for (var i = 0; i < updated_data.length; i++) {
                dfs(updated_data[i], orderedArray);
            }
            // orderedArray = updated_data;

            // console.log(calculateDistance(orderedArray));

            // DFS - convert tree to array using DFS
            function dfs(o, array) {
                if (o.isDone == undefined) {
                    array.push(o);
                    o.isDone = true;
                    // set true
                    if (o.children != undefined) {
                        for (var i = 0; i < o.children.length; i++) {
                            dfs(o.children[i], array);
                        }
                    }
                }
            }

            // DFS
            function getSuccessors(o, array) {
                if (o.children != undefined) {
                    for (var i = 0; i < o.children.length; i++) {
                        array.push(o.children[i]);
                    }
                    for (var i = 0; i < o.children.length; i++) {
                        getSuccessors(o.children[i], array)
                    }
                }
                return array;
            }

            function calculateDistance(orderedArray) {
                var sum = 0;
                orderedArray.forEach((parentProcess, pIndex) => {
                    d3.keys(parentProcess.childInfo).forEach(childProcess => {
                        sum += parentProcess.childInfo[childProcess].length * Math.abs(getProcessNameIndex(orderedArray, childProcess) - pIndex)
                    })
                });
                return sum;
            }

            var margin_left = 30;  // min margin = 30
            var rect_height = 30, rect_margin_top = 5, group_rect_height = rect_height + rect_margin_top;
            var rect_normal_height = rect_height - 8;
            var rectSpacing = 2.5;

            group_by_process_name.forEach(function (d) {
                d.position = getProcessNameIndex(orderedArray, d.key);
            });

            group_by_process_name = group_by_process_name.sort(function (a, b) {
                return a.position - b.position;
            });
            // orderedArray is the topological ordering
            //  debugger;

            var svgheight = group_by_process_name.length * (group_rect_height);

            var library = d3.nest().key(function (d) {
                return d.library
            }).entries(globalData);

            library = library.filter(function (value) {
                if (value.key != 'undefined' && value.values.length > 10) return value
            })
            var libarr = [];
            library.forEach(function (d) {
                libarr.push(d.key);
            })
            library = library.sort(function (a, b) {
                return b.values.length - a.values.length
            })
            var matrix = make2Darray(group_by_process_name.length, library.length);

            // ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿
            // ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ Huyen 2018-19 ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿ ✿

            var global_data = JSON.parse(JSON.stringify(globalData));

            global_data.sort(function (a, b) {
                return a.currenttimestamp - b.currenttimestamp;
            });

            // Variables
            var timeInterval = maxTimeStamp - minTimeStamp;
            var numSecond = timeInterval / 100000;
            var each = numSecond / granularity;
            var rect_width = 1;
            var numTimeStep = 10;

            var timeGap = timeInterval / (numTimeStep * 100000);
            var roundedSecond = ~~timeGap;
            var roundedStep = roundedSecond * 100000; // to add to each step
            var timeData = [];
            var initStepData = [];

            var lensRadius = 20;
            var pointer = -1000;

            // functions here ====================================================

            function convert(time) {     // convert time to string, if time < 10 => 0+time
                if (time < 10) {
                    return "0" + time;
                }
                else return time.toString();
            }

            function getTimeBoxData() {
                for (let i = 0; i < numTimeStep + 1; i++) {
                    // display 1+numTimeStep

                    let currentTime = (minTimeStamp + i * roundedStep) / 100000;
                    let t_hour = ~~(currentTime / 3600);
                    let t_minute = ~~((currentTime - t_hour * 3600) / 60);
                    let t_second = ~~(currentTime - t_hour * 3600 - t_minute * 60);

                    let stamp = {
                        hour: t_hour,
                        minute: t_minute,
                        second: t_second
                    };
                    let timeString = stamp.hour.toString() + ":" + convert(stamp.minute) + ":" + convert(stamp.second);

                    let step = (stamp.hour * 3600 + stamp.minute * 60 + stamp.second) * 100000 - minTimeStamp;
                    initStepData.push(step);
                    timeData.push({
                        time: timeString,
                        stamp: stamp,
                        step: step

                    })

                }
            }

            var StepScale = function (xStep, isLensing) {     // output position to display
                var norm = maxProcessLength / timeInterval;
                var gra = granularity / numTimeStep;        // granularity
                var addTime2 = timeInterval / (numTimeStep * 100000);
                var roundedSecond2 = ~~addTime2;
                var roundedStep2 = roundedSecond2 * 100000 / gra; // to add to each step

                if (isLensing === true) {

                    var stepPosition = ~~(pointer / roundedStep2);
                    leftBound = Math.max(0, roundedStep2 * (stepPosition - lensRadius));
                    rightBound = Math.min(timeInterval, roundedStep2 * (stepPosition));

                    var lensingStep = rightBound - leftBound;

                    var expoInLens = lensingMultiple * norm;
                    var remainProcessLength = maxProcessLength - lensingStep * expoInLens;
                    var expoOutLens = remainProcessLength / (timeInterval - (rightBound - leftBound));

                    var newxStep = xStep;
                    var posLeftLens = newxStep * expoOutLens;
                    var posInLens = leftBound * expoOutLens + (newxStep - leftBound) * expoInLens;
                    var posRightLens = leftBound * expoOutLens + lensingStep * expoInLens + (newxStep - rightBound) * expoOutLens;

                    if (xStep < leftBound) {
                        return posLeftLens;
                    }
                    else if (xStep > rightBound) {
                        return posRightLens;
                    }
                    else // lensing area
                        return posInLens;

                }
                else {
                    return xStep * norm;
                }
            };
            var reverseStepScale = function (x) {
                return x * timeInterval / maxProcessLength;
            };

            // SVG declarations =======================================================
            // Slider -----------------------------------------------------------------

            var magContainer = d3.select("#heatmap")
                .append("svg").attr("id", "magContainer")
                .attr("x", "100")
                .attr("y", "100")
                .attr("width", "650")
                .attr("height", "70");

            var magwidth = 400;

            magContainer.append("svg:text").attr("display", "inline-block")
                .append("svg:tspan").attr('x', 0).attr('dy', 25).text("Magnification rate: ")
                .append("svg:tspan").attr("id", "sliderValue").attr('x', 138).attr('dy', 0).text(lensingMultiple)
            // .attr("font-family", "sans-serif").attr("font-size","15px")
            ;

            var magSlider = magContainer.append("g").attr("display", "inline-block")
                .attr("class", "slider")
                .attr("transform", "translate(180, 20)");

            var x = d3.scaleLinear()
                .domain([5, 30])
                .range([0, magwidth])
                .clamp(true);

            magSlider.append("line")
                .attr("class", "track")
                .attr("x1", x.range()[0])
                .attr("x2", x.range()[1])
                .select(function () {
                    return this.parentNode.appendChild(this.cloneNode(true));
                })
                .attr("class", "track-inset")
                .select(function () {
                    return this.parentNode.appendChild(this.cloneNode(true));
                })
                .attr("class", "track-overlay")
                .call(d3.drag()
                    .on("start.interrupt", function () {
                        magSlider.interrupt();
                    })
                    .on("start drag", function () {
                        mag(x.invert(d3.event.x));
                    }));

            magSlider.insert("g", ".track-overlay")
                .attr("class", "ticks")
                .attr("transform", "translate(0," + 22 + ")")
                .selectAll("text")
                .data(x.ticks(6))
                .enter().append("text")
                .attr("x", x)
                .attr("text-anchor", "middle")
                .text(function (d) {
                    return d
                });

            var handle = magSlider.insert("circle", ".track-overlay")
                .attr("class", "handle")
                .attr("r", 8)
                .attr("cx", x(lensingMultiple));      // default = 3

            function mag(h) {
                handle.attr("cx", x(h));
                lensingMultiple = h;
                d3.select("#sliderValue").text(h.toFixed(0));
            }

            // granularity ------------------------------------------------------------------
            var graContainer = d3.select("#heatmap")
                .append("svg").attr("id", "magContainer")
                .attr("x", "50")
                .attr("y", "100")
                .attr("width", "800")
                .attr("height", "70");

            graContainer.append("svg:text").attr("display", "block")
                .append("svg:tspan").attr("id", "graValue").attr('x', 0).attr('dy', 25).text("Mouse over" +
                " timeline for magnification. ").attr("font-weight", "bold")
                .append("svg:tspan").attr("id", "graValue").attr('x', 320).attr('dy', 0).text(" Granularity: " + granularity + ". Each magnified gap equals to " + each.toFixed(2) + " seconds.").attr("font-weight", "normal")
            // .attr("font-family", "sans-serif").attr("font-size","15px")
            ;
            // SVG =======================================================================
            // Outline -----------------------------------------------------------

            getTimeBoxData();

            var timeBoxHeight = 30;
            var dashHeight = svgheight + timeBoxHeight;

            var outline = d3.select('#heatmap').append('svg').attr("class", "outline")
                .attr("height", dashHeight)
                .attr("width", "100%")
                .attr("id", "outline");

            var bbox = document.getElementById("outline");
            svgActionWidth = bbox.getBoundingClientRect().width;
            var namespace = 120;
            var maxProcessLength = svgActionWidth - namespace;   // for dislaying name of virus

            // Draw grids
            var stepData = [];
            var dashStepSpace = initStepData[1] - initStepData[0];
            var numNewSpace = granularity / numTimeStep;
            var newDashStepSpace = dashStepSpace / numNewSpace;
            for (let i = 0; i < initStepData.length; i++) {
                for (let j = 0; j < numNewSpace; j++) {
                    let temp = initStepData[i] + j * newDashStepSpace;
                    let mainIndex = (j === 0) ? true : false;
                    stepData.push({
                        step: temp,
                        main: mainIndex
                    });
                }
            }

            outline.selectAll(".verticalBars").remove();
            outline.selectAll(".verticalBars")
                .data(stepData).enter()
                .append("line")
                .attr('class', "verticalBars")
                .attr("id", (d, i) => "timestep" + i)
                .attr("x1", d => StepScale(d.step) + margin_left)
                .attr("x2", d => StepScale(d.step) + margin_left)
                .attr("y1", 0)
                .attr("y2", dashHeight)
                .style("stroke", "black")
                .style("stroke-opacity", function (d, i) {
                    if (d.main) {
                        return 0.4
                    }
                    else {
                        return 0
                    }
                })
                // .style("visibility", function (d, i) {
                //     if (d.main) {
                //         return "visible"
                //     }
                //     else {
                //         return "hidden"
                //     }
                // })
                .style("stroke-width", 1)
                .style("stroke-dasharray", function (d, i) {
                    if (d.main) {
                        return "3,2"
                    }
                    else {
                        return "1,3"
                    }
                });

            outline
                .append("line")
                .attr("id", "endStep")
                .attr("x1", svgActionWidth)
                .attr("x2", svgActionWidth)
                .attr("y1", 0)
                .attr("y2", dashHeight)
                .style("stroke", "black")
                .style("stroke-opacity", "0.4")
                .style("stroke-width", 1)
                .style("stroke-dasharray", "3, 2");

            var svg_process_name = outline.append('svg')
                .attr("id", "processes").attr('margin-left', '20px')
                .attr('width', svgActionWidth).attr('height', svgheight).attr("border", 1)
                .attr("y", "40");

            var timeBox = outline.append('svg').attr("class", "timeBox")
                .attr("height", timeBoxHeight)
                .attr("width", svgActionWidth)
                .attr("id", "svgTimeBox");

            timeBox.append("rect")
                .style("fill", "#ffffff")
                .style("fill-opacity", 0.8)
                .attr("height", 30)
                .attr("width", svgActionWidth)

            timeBox.selectAll("text").data(timeData).enter()
                .append("text")
                .attr("id", (d, i) => "timestep" + i)
                .attr("y", 20)
                .attr("x", (d, i) => {
                    return StepScale(d.step) + margin_left;
                })
                .text(d => d.time)
                .attr("fill", "black")
                .attr("font-family", "sans-serif")
                .attr("font-size", "13px")
                .attr("text-anchor", "start");


            timeBox.append("rect")
                .style("fill", "#aaa")
                .style("fill-opacity", 0.3)
                .attr("height", 30)
                .attr("width", svgActionWidth)
                .on("mousemove", function () {
                    var coordinates = [0, 0];
                    coordinates = d3.mouse(this);
                    var x = coordinates[0];
                    pointer = reverseStepScale(Math.max(0, x));

                    // console.log("x in v4: " + d3.event.clientX);
                    //
                    // console.log("x = "+x);
                    // console.log("time step (pointer): " + pointer);
                    // console.log("number of milis (pointer) = "+pointer);

                    // change lensing

                    svg_process_name.selectAll("rect").transition().duration(200)
                        .attr("x", d => (StepScale(d.Step, true)) * rect_width + margin_left);

                    timeBox.selectAll("text").transition().duration(200)
                        .attr("x", (d, i) => {
                            return StepScale(d.step, true) + margin_left;
                        });

                    orderedArray.forEach((parentProcess, pIndex) => {
                        if (parentProcess.children.length > 0) {
                            parentProcess.children.forEach((childProcess, cIndex) => {
                                parentProcess.childInfo[childProcess.key].forEach((child, i) => {
                                    svg_process_name.selectAll('.path_' + pIndex + "_" + cIndex + "_" + i)
                                        .transition().duration(200)
                                        .attr('transform', function () {
                                            var posX = (StepScale(child.step, true)) * rect_width + margin_left;
                                            var posY = (getProcessNameIndex(updated_data, childProcess.key) + pIndex) * group_rect_height / 2 + group_rect_height / 2;
                                            return 'translate(' + posX + ',' + posY + ')';
                                        });
                                })
                            })
                        }
                    });

                    svg_process_name.selectAll(".stream")
                        .transition().duration(200)
                        .attr("d", area.x(function (d, i) {
                            return StepScale(xScale(i), true) + margin_left;
                        }))

                    group_by_process_name.forEach(function (row, index) {
                        svg_process_name.selectAll(".malName" + index)
                            .transition().duration(200)
                            .attr('x', ((StepScale(row.values[row.values.length - 1].Step, true)) * rect_width + margin_left) + 5)
                            .attr('y', group_rect_height / 2)
                    });

                    outline.selectAll(".verticalBars").transition().duration(200)
                        .attr("x1", d => StepScale(d.step, true) + margin_left)
                        .attr("x2", d => StepScale(d.step, true) + margin_left)
                        .style("stroke-opacity", function (d, i) {
                            if (d.main) {
                                return 0.4
                            }    // main ticks
                            else if (d.step < leftBound) {
                                return 0;
                            }
                            else if (d.step > rightBound) {
                                return 0;
                            }
                            else {
                                return 0.2;
                            }
                        })
                        // .style("visibility", function (d, i) {
                        //     if (d.main) {
                        //         return "visible"
                        //     }    // main ticks
                        //     else if (d.step < leftBound) {
                        //         return "hidden";
                        //     }
                        //     else if (d.step > rightBound) {
                        //         return "hidden";
                        //     }
                        //     else {
                        //         return "visible";
                        //     }
                        // })
                        .style("stroke-width", 1)
                        .style("stroke-dasharray", function (d, i) {
                            if (d.main) {
                                return "3,2"
                            }
                            else {
                                return "1,3"
                            }
                        });
                })
            ;


            // stream calculation ～ ～ ～ ～ ～ ～ ～ ～ ～ ～ ～ ～ ～ ～ ～ ～ ～ ～
            // ～ ～ ～ ～ ～ ～ ～ ～ ～ ～ ～ ～ ～ ～ ～ ～ ～ ～

            var maxBin;

            function stream(group_by_process_name, globalData) {
                var group = JSON.parse(JSON.stringify(group_by_process_name));
                var global_data = JSON.parse(JSON.stringify(globalData));
                var ref = {};
                var defaultValue = 0;
                var bin = 20000;
                global_data.forEach(d => {
                    d.binStep = Math.round(d.Step / bin);
                });
                maxBin = d3.max(global_data, d => d.binStep);

                var a = group.map(process => {
                    process.values.forEach(d => {
                        d.binStep = Math.round(d.Step / bin);
                    });
                    process.values.forEach(d => {
                        if (d.Path.length > 0) {
                            ref[d.Path] = 1;
                        }
                    });

                    var binData = d3.nest()
                        .key(d => d.binStep)
                        .rollup(v => v.length)
                        .entries(process.values
                            .filter(d => d.Path.length > 0)
                        );

                    // add dummy points
                    process.lib = [];
                    for (var i = 0; i < maxBin + 1; i++) {
                        process.lib.push(binData.find(d => d.key == i) ?
                            binData.find(d => d.key == i).value : defaultValue)
                    }
                    return {
                        process: process.key,
                        calls: process.lib
                    }
                });
                // console.log(d3.keys(ref).sort((a,b) => {return a.length - b.length}));
                return a;
            }

            var streamData = stream(group_by_process_name, globalData);
            // console.log(streamData);
            // get max number of calls
            var maxCall = 0;
            streamData.forEach(record => {
                if (d3.max(record.calls) > maxCall) {
                    maxCall = d3.max(record.calls)
                }
            });

            var xScale = d3.scaleLinear()
                .domain([0, maxBin])
                .range([0, maxStep]);

            var yScale = d3.scalePoint()
                .domain(d3.range(streamData.length))
                .range([0, svgheight]);

            var streamHeightScale =
                d3.scaleSqrt()
                    .domain([0, maxCall])
                    .range([0, 2 * rect_normal_height]);

            var area = d3.area()
                .curve(d3.curveNatural)
                .x(function (d, i) {
                    return StepScale(xScale(i)) + margin_left;
                })
                .y0(function (d) {
                    return -streamHeightScale(d) / 2;
                })
                .y1(function (d) {
                    return streamHeightScale(d) / 2;
                });

            group_by_process_name.forEach(function (row, index) {
                var group = svg_process_name.append('g')
                    .attr("transform", "translate(0," + index * group_rect_height + ")");

                group.append('line').attr('stroke-dasharray', '2, 5').attr('stroke', 'black').attr('stroke-width', 0.5)
                // .attr('x1', (StepScale(row.values[0].Step) * rect_width + margin_left + 10)).attr('y1', rect_height / 2)
                // .attr('x2', (((StepScale(row.values[row.values.length - 1].Step)) * rect_width + margin_left) + 10)).attr('y2', rect_height / 2);
                    .attr('x1', (StepScale(minStep) * rect_width + margin_left + 10))
                    .attr('y1', rect_height / 2)
                    .attr('x2', (((StepScale(maxStep)) * rect_width + margin_left) + 10))
                    .attr('y2', rect_height / 2);

                var processes = row.values.filter(function (filter) {
                    if (filter.hasOwnProperty('library') && libarr.includes(filter.library) == true) return filter;
                });
                var filtered_library = d3.nest().key(function (d) {
                    return d.library
                }).entries(processes)

                filtered_library.forEach(function (d) {
                    var obj = {};
                    obj.source = index;
                    obj.target = libarr.indexOf(d.key);
                    obj.value = d.values;

                    lines.push(obj);
                })

                // streamDraw =========================
                var stream = group.selectAll("path").data([streamData[index].calls])
                    .enter().append("path")
                    .style("fill", "#9d9d9d")
                    .attr("transform", function (d, i) {
                        return "translate(0" + "," + yScale(i) + (rectSpacing + rect_normal_height / 2) + ")";
                    })
                    .attr("class", "stream")
                    .attr("d", area);

                // textDraw
                group.append('text').attr("class", "malName" + index).text(row.key.substring(0, 20))
                    .attr('x', ((StepScale(row.values[row.values.length - 1].Step)) * rect_width + margin_left) + 5).attr('y', group_rect_height / 2)
                    .attr('text-anchor', 'start');

                //======================= rectDraw for process here ================================
                var rect = group.selectAll('rect')
                    .data(row.values
                        // .filter(d => d["Process"] !== "Profiling")
                    ).enter().append('rect')
                    .attr('class', function (d, i) {
                        return d.Operation.replace(" ", "");
                    })
                    .attr('x', function (d, i) {
                        return (StepScale(d.Step)) * rect_width + margin_left;
                    })
                    .attr('group', 'detail')
                    .attr('id', function (d) {
                        return d.Step;
                    }).attr('y', function (d) {
                        if (d.hasOwnProperty('VirusTotal')) {
                            if (d.VirusTotal.malicious > 0)
                                return 0;
                        }
                        else {
                            return rectSpacing;
                        }
                    })
                    .attr('width', rect_width)
                    .attr('height', function (d) {
                        if (d.hasOwnProperty('VirusTotal')) {
                            if (d.VirusTotal.malicious > 0)
                                return rect_height;
                        }
                        else {
                            return rect_normal_height;
                        }
                    })
                    .style('fill-opacity', 0.4)
                    .attr('fill', function (d) {
                        return colorPicker(d.Operation);
                    })
                    .style("visibility", d => {
                        if (d["Process"] !== "Profiling") {
                            return "visible"
                        }
                        else return "hidden"
                    })
                    .on('mouseover', function (d) {
                        if (d.Operation == 'UDP Send' && d.hasOwnProperty('VirusTotal')) {

                            div.transition()
                                .duration(200)
                                .style("opacity", 1).style('width', '250px');
                            div.html('<table><tr><td colspan="4">Source: https://www.virustotal.com</td></tr><tr><td><img src="images/clean.png" width="20" height="20"/></td><td> Clean (' + d.VirusTotal.harmless + ')</td>' +
                                '<td><img src="images/malicious.png" width="20" height="20"/></td><td><font color="red"><b>Malicious (' + d.VirusTotal.malicious + ')</b> </font></td></tr>' +
                                '<tr><td><img src="images/suspicious.png" width="20" height="20"/></td><td> Suspicious (' + d.VirusTotal.suspicious + ')</td>' +
                                '<td><img src="images/question.png" width="20" height="20"/></td><td> Undetected (' + d.VirusTotal.undetected + ')</td></tr><tr><td colspan="4">Target domain: ' + d.Domain + '</td></tr>' +
                                '<td colspan="4">Connecting time: ' + d.Timestamp + '</td></tr></table>')
                                .style("left", (d3.event.pageX) + "px")
                                .style("top", (d3.event.pageY - 28) + "px");
                        }
                        else {
                            // Tooltip for processes
                            div2.transition()
                                .duration(100)
                                .style("opacity", 1);
                            div2
                                .html(
                                    "<table>"
                                    + "<col width='80'>"

                                    + "<tr>"
                                    + "<td>Program</td>"
                                    + "<td class ='bold'>" + d.Process_Name + "</td>"
                                    + "</tr>"
                                    + "<tr>"
                                    + "<td>Operation</td>"
                                    + "<td class ='bold' style='color: " + colorPicker(d.Operation) + ";'>" + d.Operation + "</td>"
                                    + "</tr>"
                                    + "<tr>"
                                    + "<td>Event type</td>"
                                    + "<td>" + d.Process + "</td>"
                                    + "</tr>"
                                    + "<tr>"
                                    + "<td>Timestamp</td>"
                                    + "<td >" + d.Timestamp + "</td>"
                                    + "</tr>"
                                    + "<tr>"
                                    + "<td>Path</td>"
                                    + "<td>" + d.Path + "</td>"
                                    + "</tr>"


                                    + "<tr>"
                                    + "<td>Detail</td>"
                                    + "<td>" + d.Detail + "</td>"
                                    + "</tr>"


                                    + "<tr>"
                                    + "<td>PID</td>"
                                    + "<td>" + d.PID + "</td>"
                                    + "</tr>"
                                    + "</table>")
                                .style("left", (d3.event.pageX) + 20 + "px")
                                .style("top", (d3.event.pageY + 20) + "px")
                                .style("pointer-events", "none");
                        }
                    })
                    .on('click', function (d) {
                        var paths = d3.selectAll('path.detail_path').style('opacity', 0);
                        d3.selectAll('path[source="' + (getProcessNameIndex(updated_data, d.Process_Name)) + '"]').style('opacity', 1)
                        ;

                    })
                    .on('mouseout', d => {
                        div2.transition()
                            .duration(100)
                            .style("opacity", 0);
                    });
            });

            outline.on("mouseleave", function () {
                outline.selectAll(".verticalBars").transition().duration(200)
                    .attr("x1", d => StepScale(d.step) + margin_left)
                    .attr("x2", d => StepScale(d.step) + margin_left)
                    .style("stroke-opacity", function (d, i) {
                        if (d.main) {
                            return 0.4
                        }
                        else {
                            return 0
                        }
                    })

                    .style("stroke-width", 1)
                    .style("stroke-dasharray", function (d, i) {
                        if (d.main) {
                            return "3,2"
                        }
                        else {
                            return "1,3"
                        }
                    });
                ;

                svg_process_name.selectAll("rect").transition().duration(200)
                    .attr("x", d => (StepScale(d.Step)) * rect_width + margin_left);

                timeBox.selectAll("text").transition().duration(200)
                    .attr("x", (d, i) => {
                        return StepScale(d.step) + margin_left;
                    });

                orderedArray.forEach((parentProcess, pIndex) => {
                    if (parentProcess.children.length > 0) {
                        parentProcess.children.forEach((childProcess, cIndex) => {
                            parentProcess.childInfo[childProcess.key].forEach((child, i) => {
                                svg_process_name.selectAll('.path_' + pIndex + "_" + cIndex + "_" + i)
                                    .transition().duration(200)
                                    .attr('transform', function () {
                                        var posX = (StepScale(child.step)) * rect_width + margin_left;
                                        var posY = (getProcessNameIndex(updated_data, childProcess.key) + pIndex) * group_rect_height / 2 + group_rect_height / 2;
                                        return 'translate(' + posX + ',' + posY + ')';
                                    });
                            })
                        })
                    }
                });
                svg_process_name.selectAll(".stream")
                    .transition().duration(200)
                    .attr("d", area.x(function (d, i) {
                        return StepScale(xScale(i)) + margin_left;
                    }));

                group_by_process_name.forEach(function (row, index) {
                    svg_process_name.selectAll(".malName" + index)
                        .transition().duration(200)
                        .attr('x', ((StepScale(row.values[row.values.length - 1].Step)) * rect_width + margin_left) + 5).attr('y', group_rect_height / 2)
                });

            });

            orderedArray.forEach((parentProcess, pIndex) => {
                if (parentProcess.children.length > 0) {
                    parentProcess.children.forEach((childProcess, cIndex) => {
                        // define arrow
                        svg_process_name
                            .append("svg:defs")
                            .selectAll(".arrow")
                            .data(parentProcess.childInfo[childProcess.key])
                            .enter()
                            .append("svg:marker")
                            .attr("id", (d, i) => {
                                return "arrow_" + pIndex + "_" + cIndex + "_" + i
                            })
                            .attr("class", "arrow")
                            .attr("refX", 6)
                            .attr("refY", 4)
                            .attr("markerWidth", 8)
                            .attr("markerHeight", 8)
                            .style("fill", d => colorPicker(d.event))
                            .attr("orient", 0)
                            .append('path')
                            .attr('d', 'M0,0 L0,8 L8,4 z');

                        // draw arc
                        var signedOrienation = getProcessNameIndex(updated_data, childProcess.key) - pIndex;
                        parentProcess.childInfo[childProcess.key].forEach((child, i) => {
                            svg_process_name
                                .append('path').attr("class", () => {
                                return 'arc a' + pIndex + "_" + cIndex + ' path_' + pIndex + "_" + cIndex + "_" + i + " o" + child.event.replace(" ", "");
                            })
                                .attr('d', d3.arc()
                                    .innerRadius(Math.abs(signedOrienation) * group_rect_height / 2 - 1)
                                    .outerRadius(Math.abs(signedOrienation) * group_rect_height / 2)
                                    .startAngle(signedOrienation > 0 ? -Math.PI : Math.PI / 90) //converting from degs to radians
                                    .endAngle(signedOrienation > 0 ? Math.PI / 90 : -Math.PI))
                                .attr('fill', colorPicker(child.event))
                                .attr('source', pIndex)
                                .attr('target', getProcessNameIndex(updated_data, childProcess.key))
                                .attr('transform', function () {

                                    var posX = (StepScale(child.step)) * rect_width + margin_left;
                                    var posY = (getProcessNameIndex(updated_data, childProcess.key) + pIndex) * group_rect_height / 2 + group_rect_height / 2;

                                    return 'translate(' + posX + ',' + posY + ')';
                                })
                                .attr("marker-end", "url(#arrow_" + pIndex + "_" + cIndex + "_" + i + ")")
                                .on("mouseover", function () {
                                    if (arcSelect) {
                                    }
                                    else {
                                        d3.selectAll(".arc")
                                            .classed("normV", false)
                                            .classed("normH", true);

                                        d3.select('.path_' + pIndex + "_" + cIndex + "_" + i)
                                            .classed("normV", true)
                                            .classed("normH", false);
                                    }

                                    div3.transition()
                                        .duration(200)
                                        .style("opacity", 1);

                                    div3.html('Source: ' +
                                        '<text class = "bold">' + parentProcess.key + "</text><br/> Target: " + '<text class = "bold">' + childProcess.key + "</text><br/>")
                                        .style("left", (d3.event.pageX) + 20 + "px")
                                        .style("top", (d3.event.pageY - 30) + "px")
                                        .style("pointer-events", "none")
                                        .style("background-color", () => {
                                                // return colorPicker(child.event).replace("(", "a(").replace(")", ", 0.8)");
                                                return "#dddddd"
                                            }
                                        )
                                })
                                .on("mouseout", function () {
                                    if (arcSelect) {
                                        d3.selectAll(".arc.visible")
                                            .classed("visible", true)
                                            .classed("hidden", false);
                                    }
                                    else {
                                        d3.selectAll(".arc")
                                            .classed("normV", true)
                                            .classed("normH", false);
                                    }

                                    div3.style("opacity", 0);
                                })

                        })

                    })
                }
            });

            function hexToRgb(hex) {
                var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? {
                    r: parseInt(result[1], 16),
                    g: parseInt(result[2], 16),
                    b: parseInt(result[3], 16)
                } : null;
            }

            for (var i = 0; i < lines.length; i++) {
                var obj = new Object();
                obj.source = lines[i].source;
                obj.target = lines[i].target;
                obj.value = lines[i].value;
                matrix[lines[i].source][lines[i].target] = obj;
                // dllLines.append('line').attr('stroke-width', ddlLineScale(lines[i].value)).attr('class', 'dllline')
                //     .attr('x1', max_scale+60).attr('source', lines[i].source).attr('target', lines[i].target).attr('y1', lines[i].source * group_rect_height + rect_height / 2)
                //     .attr('x2', window.innerWidth-210).attr('y2', lines[i].target * ((dll_height + padding)) + (dll_height + padding) / 4)
            }
            globalmatrix = matrix;
            globalib = libarr;
            globalgroupbyprocessname = group_by_process_name;

            //drawMatrixOld(matrix, libarr, group_by_process_name);

        },
        draw2DMatrix: function (position) {
            var graphs = ExtractGraph(globalData);
            graphs.links = graphs.links.filter(function (link) {
                return link.value.length > settings.MatrixArea.minValue;
            });
            graphs.indexLinks = [];
            var rect_width = (settings.MatrixArea.matrix_width - settings.MatrixArea.padding * (graphs.targets.length - 1)) / graphs.targets.length;
            var svgMatrix = d3.select(position).append('svg').attr('height', settings.MatrixArea.svg_height).attr('width', settings.MatrixArea.svg_width).attr('margin-top', "15px");
            var matrix = make2Darray(graphs.sources.length, graphs.targets.length);

        },
        sort2DMatrix: function (type) {
            var nodes = createNodesFromLinks(global_links);
            var sourcename = JSON.parse(JSON.stringify(nodes.sources));
            var targetname = JSON.parse(JSON.stringify(nodes.targets));
            var local_links = JSON.parse(JSON.stringify(global_links));
            switch (type) {
                case "name":
                    sourcename = sortArrayByName(sourcename);
                    targetname = sortArrayByName(targetname);
                    break;
                case "numlinks":
                    sourcename = sortArrayByLinkSize(sourcename);
                    targetname = sortArrayByLinkSize(targetname);
                    break;
                case "numcount":
                    sourcename = sortArrayByCountSize(sourcename);
                    targetname = sortArrayByCountSize(targetname);
                    break;
                case "similarity":
                    sortArrayBySimilarity(sourcename, targetname, local_links);
                    break;
                default:
                    break;
            }
            //convert link by name to link by id
            local_links.forEach(function (link) {
                link.source = getIndexByName(sourcename, link.source);
                link.target = getIndexByName(targetname, link.target);
            });
            var matrix = create2DMatrix(sourcename.length, targetname.length, local_links);
            drawMatrix(sourcename, targetname, matrix, '#matrix2D')

        },
        getCallRange: function () {
            var graphs = ExtractGraph(globalData);//Extract Graph to get all data.
            var min = d3.min(graphs.links, function (d) {
                return d.value.length;
            });
            var max = d3.max(graphs.links, function (d) {
                return d.value.length;
            })
            return {mincall: min, maxcall: max}
        },
        updateRangeFilter: function (min, max) {
            global_links = ExtractGraph(globalData).links.filter(function (link) {
                return link.value.length > min;
            });
            d3.select("#matrix2D").selectAll("*").remove();
            loadMatrix(global_links);

        },
        updateDomainBox: function (position) {
            d3.select(position).selectAll("*").remove();
            var domainList = getData.getdatabyDomain;
            var selection = document.querySelector(position);
            var count = 1;
            for (var key in domainList) {
                var option = document.createElement('option');
                option.textContent = count + ". " + key;
                option.value = domainList[key].Step;
                option.title = domainList[key].Process_Name + " [" + domainList[key].Timestamp + "]";
                if (domainList[key].VirusTotal) {
                    if (domainList[key].VirusTotal.malicious > 0) {
                        option.className = 'malicious';
                        option.textContent = count + ". " + key + '-> malicious by Virus Total';
                    }
                }
                selection.appendChild(option);
                count++;
            }


        }

    }

}
function selectAll() {
    var selectAll = document.getElementById("opSelection").checked;
    if (selectAll){
        // show all rect
        d3.select("#heatmap").selectAll('rect[group=detail]')
            .style('visibility', "visible");

        // show all arc
        d3.selectAll(".arc")
            .classed("hidden", false)
            .classed("visible", true);

        // select all group
        d3.select("#overview").selectAll("rect")
            .classed("op1", true)
            .classed("op0 op2", false);
    }
    else {
        d3.select("#heatmap").selectAll('rect[group=detail]')
            .style('visibility', "hidden");

        // hide all arc
        d3.selectAll(".arc")
            .classed("hidden", true)
            .classed("visible", false);

        // hide all group
        d3.select("#overview").selectAll("rect")
            .classed("op0", true)
            .classed("op1 op2", false);
    }
}