model.loadRandomSystem = function() {
    var self = model;
    var generatorConfig = {
        seed: Math.random(),
        players: 2
    };

    return generateSystem(generatorConfig).then(function (system) {
            UberUtility.unfixupPlanetConfig(system);

            self.loadedSystem(system);
            self.updateSystem();
            self.requestUpdateCheatConfig();
        });
}

var clip = function(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

var generateSystem = function(config) {
    var rng = new Math.seedrandom(config.seed !== undefined ? config.seed : Math.random());
    //var rng = new Math.seedrandom(6);
    var getRandomInt = function (minmax, max) {
        if (max == undefined) { // passed list [min,max]
            return Math.floor(rng() * (minmax[1] - minmax[0] + 1)) + minmax[0];
        } else { // passed [min,max] as separate arguments
            var min = minmax;
            return Math.floor(rng() * (max - min + 1)) + min;
        }

    };

    // Weighted random choice from an array, where each element in the array is
    // the cumulative probability for the current and all previous elements
    var getChoice = function(arr) {
        var x = getRandomInt(1, arr[arr.length-1]);
        return _.findLastIndex(arr, function (k) { return k < x; }) + 1;
    }

    var rSystem = {
        name: 'Awesome System ' + getRandomInt(100, 30000),
        isRandomlyGenerated: true,
        Players: [2, 10]
    };

    var nLarge = parseInt($('input#large-planets').val());
    var nMedium = parseInt($('input#medium-planets').val());
    var nSmall = parseInt($('input#small-planets').val());
    var nTiny = parseInt($('input#tiny-planets').val());
    var nGas = parseInt($('input#gas-giants').val());
    var nLaser = parseInt($('input#laser-planets').val()); // r >= 500; large
    var nStart = parseInt($('input#start-planets').val()); // small, medium, and large
    var nLaunch = parseInt($('input#launchable-planets').val()); // small and tiny

    var specs = [];

    // Create Gas Giants
    for (var i = 0; i < nGas; i++) {
        specs.push({biome: ['gas'],
                    radius: getRandomInt(1000,1500),
                    mass: 50000,
                    size: 'gas'});
    }

    // Create Annihilaser planets, taking a slot for a large or medium planet
    for (var i = 0; i < nLaser; i++) {
        var cdf = [nMedium, nMedium+nLarge];
        var k = getChoice(cdf);
        if (getChoice(cdf) == 0) {
            specs.push({biome: ['metal'],
                        radius: getRandomInt(500, 600),
                        mass: 20000,
                        size: 'medium',
                        laser: true});
            nMedium -= 1;
        } else {
            specs.push({biome: ['metal'],
                        radius: getRandomInt(600, 1000),
                        mass: 40000,
                        size: 'large',
                        laser: true});
            nLarge = Math.max(nLarge-1, 0);
        }
    }

    // biome data; probabilities ordered (tiny, small, medium, large)
    biomes = [
        {biome:'earth',    probabilities: [ 0, 5,10,10]},
        {biome:'desert',   probabilities: [ 5, 7,10,10]},
        {biome:'lava',     probabilities: [10,10, 5, 5]},
        {biome:'tropical', probabilities: [ 5 ,5,10,10]},
        {biome:'moon',     probabilities: [10,10, 5, 0]},
        {biome:'metal',    probabilities: [10,10, 0, 0]}
    ];

    var sizes = [{size:'tiny', n:nTiny, m:5000, r1:150, r2:240},
                 {size:'small', n:nSmall, m:10000, r1:240, r2:380},
                 {size:'medium', n:nMedium, m:20000, r1:380, r2:600},
                 {size:'large', n:nLarge, m:40000, r1:600, r2:1000}];

    // Populate sizes and biomes for regular planets
    for (var j = 0; j < sizes.length; j++) {
        var cdf = [];
        var sum = 0;
        for (var i = 0; i < biomes.length; i++) {
            sum += biomes[i].probabilities[j];
            cdf.push(sum);
        }
        for (var i = 0; i < sizes[j].n; i++) {
            var k = getChoice(cdf);
            specs.push({biome: [biomes[k].biome],
                        mass: sizes[j].m,
                        radius: getRandomInt(sizes[j].r1, sizes[j].r2),
                        size: sizes[j].size
            })
        }
    }

    // Populate launchable planets (smallest radius)
    specs = _.sortBy(specs, function(s) { return s.mass });
    var nLeft = nLaunch;
    for (var i = 0; i < specs.length; i++) {
        if (nLeft == 0) {
            break;
        }
        if (specs[i].mass[0] > 10000) {
            continue;
        }
        specs[i].launch = [2, 4];
        nLeft -= 1;
    }

    var allowGameEnderStart = model.allowGameEnderStart();
    var nAvailable = nSmall + nMedium + nLarge;
    if (!allowGameEnderStart) {
        nAvailable -= nLaunch + nLaser;
    }

    // Generally don't want tiny start planets, but use them if we have to
    if (nAvailable < nStart) {
        nAvailable += nTiny;
        var allowTinyStart = true;
    } else {
        var allowTinyStart = false;
    }

    // Ignore 'allowGameEnderStart' if there's no other option
    if (nAvailable < nStart) {
        model.allowGameEnderStart(true);
        allowGameEnderStart = true;
        nAvailable += nLaunch + nLaser;
    }

    // If we still don't have enough, cut down on the number of start planets
    if (nAvailable < nStart) {
        nStart = nAvailable;
    }

    // Populate start planets
    specs = _.shuffle(specs);
    var nLeft = nStart;
    for (var i = 0; i < specs.length; i++) {
        if (nLeft == 0) {
            break;
        }
        if ((specs[i].biome[0] == 'gas') ||
            (!allowTinyStart && specs[i].mass == 5000) ||
            (!allowGameEnderStart && specs[i].launch) ||
            (!allowGameEnderStart && specs[i].laser)) {
            continue;
        }
        specs[i].start = true;
        nLeft -= 1;
    }

    // Assign planets to orbits, in decreasing order by size
    specs = _.sortBy(specs, function(s) { return -s.mass });
    for (var i = 0; i < specs.length; i++) {
        specs[i].id = i;
    }
    var orbits = [
        {planet: -1, children: [], weight: 5, capacity: 4, maxMass: 1e5},
        {planet: -1, children: [], weight: 3, capacity: 5, maxMass: 1e5},
        {planet: -1, children: [], weight: 2, capacity: 5, maxMass: 1e5},
        {planet: -1, children: [], weight: 1, capacity: 3, maxMass: 1e5}];

    for (var i = 0; i < specs.length; i++) {
        var spec = specs[i];
        // Pick an orbit for this planet
        var cdf = [];
        var total = 0;
        for (var j = 0; j < orbits.length; j++) {
            var orbit = orbits[j];
            if (spec.mass <= orbit.maxMass && orbit.capacity) {
                total += orbit.weight;
            }
            cdf.push(total);
        }
        var orbit = orbits[getChoice(cdf)];
        orbit.children.push(spec.id);
        spec.orbit = orbit;
        if (orbit.children.length == orbit.capacity) {
            orbit.weight = 0;
        }

        // Add orbits provided by this planet, if any.
        // Planets orbiting other planets may not provide orbits.
        if (spec.mass >= 50000 && orbit.planet == -1) {
            // Gas giant: permits medium and smaller as moons
            orbits.push({planet: spec.id, children: [], weight: 8,
                         capacity: 2, maxMass: 20000});
            orbits.push({planet: spec.id, children: [], weight: 6,
                         capacity: 2, maxMass: 20000});
        } else if (spec.mass >= 40000 && orbit.planet == -1) {
            // Large planet: permits small and tiny as moons
            orbits.push({planet: spec.id, children: [], weight: 5,
                         capacity: 2, maxMass: 10000});
        } else if (spec.mass >= 20000 && orbit.planet == -1) {
            // medium planet: permits tiny moons
            orbits.push({planet: spec.id, children: [], weight: 4,
                         capacity: 2, maxMass: 5000});
        }
    }
    // Remove any empty orbits:
    orbits = _.filter(orbits, function(orbit) { return orbit.children.length; });

    // Stupid hack to prevent unintended capture: Set mass for all primary
    // planets to be equal.
    for (var j = 0; j < orbits.length; j++) {
        var orbit = orbits[j];
        if (orbit.planet != -1) {
            break;
        }
        for (var i = 0; i < orbit.children.length; i++) {
            specs[orbit.children[i]].mass = 50000;
        }
    }

    // Link each orbit to its inner neighbor, if there is one, and to the parent
    // planet
    _.forEach(specs, function(s) { s.orbits = []; });
    var lastPlanet = undefined;
    var lastOrbit = undefined;
    for (var j = 0; j < orbits.length; j++) {
        if (lastPlanet == orbits[j].planet) {
            orbits[j].inner = lastOrbit;
        }
        if (orbits[j].planet != -1) {
            specs[orbits[j].planet].orbits.push(orbits[j]);
        }
        lastPlanet = orbits[j].planet;
        lastOrbit = orbits[j];
    }

    // Set radius for orbits around planets
    for (var j = 0; j < orbits.length; j++) {
        var orbit = orbits[j];
        if (orbit.planet == -1) {
            continue;
        }
        var rmax = _.max(_.map(orbit.children,
                               function(c) { return specs[c].radius}));
        if (orbit.inner) {
            orbit.radius = 2000 + orbit.inner.radius + rmax;
        } else {
            orbit.radius = Math.max(800 + 1.5*specs[orbit.planet].radius,
                                       1600 + 3*rmax) + 1000;
        }
        specs[orbit.planet].rEffective = orbit.radius + rmax;
    }

    var getMaxRadius = function(ids) {
        var rMax = 0;
        for (var i = 0; i < ids.length; i++) {
            if (specs[ids[i]].rEffective) {
                rMax = Math.max(rMax, specs[ids[i]].rEffective);
            } else {
                rMax = Math.max(rMax, specs[ids[i]].radius);
            }
        }
        return rMax;
    }

    // Determine radius of the first solar orbit
    var getSolarMin = function(p) {
        return (1e5*p.radius + 5e7)/p.mass + p.radius + 1000;
    }
    orbits[0].radius = 13000 + getMaxRadius(orbits[0].children);
    for (var i = 0; i < orbits[0].children.length; i++) {
        var planet = specs[orbits[0].children[i]];
        var r = getSolarMin(planet);
        // Loop over orbits around this planet and the planets in them as well
        for (var j = 0; j < orbits.length; j++) {
            if (orbits[j].planet != planet.id) {
                continue;
            }
            for (var k = 0; k < orbits[j].children.length; k++) {
                r = Math.max(r, orbits[j].radius +
                                getSolarMin(specs[orbits[j].children[k]]));
            }
        }
        orbits[0].radius = Math.max(orbits[0].radius, r);
    }

    // Set radii for remaining solar orbits
    for (var j = 1; j < orbits.length; j++) {
        var orbit = orbits[j];
        if (orbit.planet != -1) {
            break;
        }

        var rmax = Math.max(getMaxRadius(orbit.children),
                            getMaxRadius(orbit.inner.children));
        orbit.radius = orbit.inner.radius + 2 * rmax + 1000;
    }

    // Determine the order of the planets, from innermost to outermost (keeping
    // moons with their parents) so that they will appear in this order in the
    // in-game planets list
    var planet_order = [];
    for (var j = 0; j < orbits.length && orbits[j].planet == -1; j++) {
        for (var i = 0; i < orbits[j].children.length; i++) {
            planet_order.push(orbits[j].children[i]);
            var planet = specs[orbits[j].children[i]];
            for (var k = 0; k < planet.orbits.length; k++) {
                Array.prototype.push.apply(planet_order,
                                           planet.orbits[k].children);
            }
        }
    }
    var spec_index = [];
    for (var i = 0; i < planet_order.length; i++) {
        spec_index[planet_order[i]] = i;
    }

    // Determine parameters for metal spot distributions
    // Base values are a function of planet size
    var metalDensity = {tiny: [5,10], small: [15,20], medium: [25,35],
                        large: [40,45], gas: [0,0]}
    var metalClusters = {tiny: [8,13], small: [20,25], medium: [25,35],
                         large: [55,65], gas:[0,0]}
    // Adjustments to metal (density,clusters) based biome
    var deltaMetal = {lava:[10,5], metal:[15,10]};

    for (var i = 0; i < specs.length; i++) {
        var spec = specs[i];
        spec.metalDensity = getRandomInt(metalDensity[spec.size]);
        spec.metalClusters = getRandomInt(metalClusters[spec.size]);
        if (spec.biome[0] == 'gas') {
            continue;
        }
        var delta = deltaMetal[spec.biome];
        if (delta != undefined) {
            spec.metalDensity += delta[0];
            spec.metalClusters += delta[1];
        }
        if (spec.launchable) {
            spec.metalDensity -= 6;
            spec.metalClusters -= 10;
        }
        if (spec.laser) {
            spec.metalDensity -= 20;
            spec.metalClusters -= 20;
        }
        if (spec.start) {
            spec.metalDensity = Math.max(spec.metalDensity-10, 2);
            spec.metalClusters = Math.max(50, spec.metalClusters);
        }
        spec.metalDensity = clip(spec.metalDensity, 0, 100);
        spec.metalClusters = clip(spec.metalClusters, 0, 100);
    }
    }
    var cSys = { Planets: []};

    //  Assign positions and velocities to all the planets; set up data used for
    //  planet generation
    for (var j = 0; j < orbits.length; j++) {
        var orbit = orbits[j];
        var N = orbit.children.length;
        var theta = getRandomInt(0, 360) / 360 * 2 * Math.PI;

        // Orbital parameters of the body that this planet orbits
        if (orbit.planet == -1) {
            var r0 = [0,0];
            var v0 = [0,0];
            var M = 100000;
        } else {
            var parent = specs[orbit.planet];
            var M = parent.mass;
            var r0 = parent.position;
            var v0 = parent.velocity;
        }

        for (var i = 0; i < N; i++) {
            var child = specs[orbit.children[i]];
            var r = orbit.radius;
            var v = Math.sqrt(5000 * M / r);
            child.position = [r0[0] + r * Math.cos(theta),
                              r0[1] + r * Math.sin(theta)];
            child.velocity = [v0[0] - v * Math.sin(theta),
                              v0[1] + v * Math.cos(theta)];
            theta += 2 * Math.PI / N;

            var p =  {
                starting_planet: child.start,
                mass: child.mass,
                Thrust: child.launch || [0, 0],
                Radius: [child.radius, child.radius],
                Height: [20, 25],
                Water: [33, 35],
                Temp: [0, 100],
                MetalDensity: child.metalDensity,
                MetalClusters: child.metalClusters,
                BiomeScale: [100, 100],
                Position: child.position,
                Velocity: child.velocity,
                Biomes: child.biome};
            cSys.Planets[spec_index[orbit.children[i]]] = p;
        }
    }

    // Debug printing
    console.log('*****************************************');
    for (var j = 0; j < orbits.length; j++) {
        console.log('orbit', j, orbits[j].planet, orbits[j].radius,
                    orbits[j].children);
    }
    console.log('---');
    for (var j = 0; j < cSys.Planets.length; j++) {
        console.log('planet', j, cSys.Planets[j].mass, cSys.Planets[j].Radius,
            cSys.Planets[j].Position[0], cSys.Planets[j].Position[1],
            cSys.Planets[j].Velocity[0], cSys.Planets[j].Velocity[1]);
    }

    var planet_template =
    {
        name: "Default Planet",
        mass: 5000,
        position: [0, 0],
        velocity: [0, 0],
        required_thrust_to_move: 0,
        generator: {
            seed: 15,
            radius: 100,
            heightRange: 25,
            waterHeight: 35,
            temperature: 100,
            metalDensity: 50,
            metalClusters: 50,
            biomeScale: 100,
            biome: "earth"
        }
    };

    // build the planets based on the random numbers in the system template.
    var pgen = _.map(cSys.Planets, function(plnt, index) {
        var bp = _.cloneDeep(planet_template);
        bp.generator.seed = getRandomInt(0, 32767);
        bp.generator.biome = _.sample(plnt.Biomes);

        var biomeGet = $.get('coui://pa/terrain/' + bp.generator.biome + '.json')
            .then(function(data) {
                return JSON.parse(data);
            });
        var nameGet = plnt.name;
        if (!nameGet) {
            nameGet = $.Deferred();
            api.game.getRandomPlanetName().then(function(name) { nameGet.resolve(name); });
        }
        return $.when(biomeGet, nameGet).then(function(biomeInfo, name) {

            bp.generator.radius = getRandomInt(plnt.Radius);
            bp.generator.heightRange = getRandomInt(plnt.Height);
            bp.generator.waterHeight = getRandomInt(plnt.Water);
            bp.generator.temperature = getRandomInt(plnt.Temp);
            bp.generator.biomeScale = getRandomInt(plnt.BiomeScale);
            bp.generator.metalDensity = plnt.MetalDensity;
            bp.generator.metalClusters = plnt.MetalClusters;
            bp.generator.index = index;
            bp.name = name;
            bp.position = plnt.Position;
            bp.velocity = plnt.Velocity;
            bp.required_thrust_to_move = getRandomInt(plnt.Thrust);
            bp.mass = plnt.mass;
            bp.starting_planet = plnt.starting_planet;

            return bp;
        });
    });

    return $.when.apply($, pgen).then(function() {
        rSystem.planets = Array.prototype.slice.call(arguments, 0);
        return rSystem;
    });
};


$(function () {
    var controls = $('<div style="margin-left: 6px;"><table id="ap-controls"></table></div>');
    $('.system-controls').append(controls);

    var table = $('table#ap-controls');

    var addControl = function(id, label, value) {
        var tr = $('<tr></tr>');
        tr.append($('<td style="padding: 6px">' + label + ':</td>'));
        var td = $('<td></td>');
        tr.append(td);
        var i = $('<input type="text" style="width: 3em; text-align:right">');
        td.append(i);
        i.attr('id', id);
        i.attr('value', value);
        table.append(tr);
    }

    addControl('large-planets', 'Large Planets', 0);
    addControl('medium-planets', 'Medium Planets', 2);
    addControl('small-planets', 'Small Planets', 0);
    addControl('tiny-planets', 'Tiny Planets', 2);
    addControl('gas-giants', 'Gas Giants', 1);
    addControl('start-planets', 'Start Planets', 2);
    addControl('launchable-planets', 'Launchable Planets', 2);
    addControl('laser-planets', 'Annihilaser Planets', 0);

    var addCheckbox = function(name, label, defaultValue) {
        var L = $('<label data-bind="click: toggle_' + name + '"></label>');
        L.append($('<input type="checkbox" style="pointer-events: none !important;" data-bind="checked: '+name+', enable: canChangeSettings">'));
        L.append(' ' + label);
        controls.append(L);

        model[name] = ko.observable(defaultValue);
        model['toggle_'+name] = function() {
            model[name](!model[name]());
        }
        ko.applyBindings(model, L[0]);
    }

    addCheckbox('allowGameEnderStart', 'Allow start planets with game enders', false);
});
