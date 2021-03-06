function getRandomSeed() {
    return Math.floor(65536 * Math.random());
}

// Global variables used for verifying the system configuration after it's been
// returned from the server
var ASG = {
    // Check the system config if verifyCount == 1.
    // Decrement if verifyCount > 0.
    verifyCount: 0,
    failureCount: 0,
    seed: getRandomSeed()
};

model.generateAwesomeSystem = function(model, event, seed) {
    return generateSystem(seed).then(function (system) {
            model.system(system);
            model.updateSystem(model.system());
            model.changeSettings();
            model.requestUpdateCheatConfig();
        });
}

model.generateSystemFromId = function(model, event) {
    var seed = decodeSystemId();
    return model.generateAwesomeSystem(model, event, seed);
}

var clip = function(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function encodeSystemId() {
    var nLarge = parseInt(model.asg_large_planets());
    var nMedium = parseInt(model.asg_medium_planets());
    var nSmall = parseInt(model.asg_small_planets());
    var nTiny = parseInt(model.asg_tiny_planets());
    var nGas = parseInt(model.asg_gas_giants());
    var nStart = parseInt(model.asg_start_planets()); // small, medium, and large
    var nLaunch = parseInt(model.asg_launchable_planets()); // small and tiny
    var nLaser = parseInt(model.asg_laser_planets()); // r >= 500; large
    var slots = model.slots() || 2; // ignore spurious zero
    var metalSpots = parseInt(model.asg_metal_spots()) * slots;
    var allowGameEnderStart = model.allowGameEnderStart();

    var bools = [allowGameEnderStart, model.symmetricalStarts()]
    var boolKey = _.reduce(bools,
            function(r, val, i) { return r + (val ? 1 : 0) * Math.pow(2, i) })
    var configVars = [nLarge, nMedium, nSmall, nTiny, nGas,
                      nStart, nLaunch, nLaser, boolKey];
    var base = _.max(configVars) + 1;
    var configItems = [ASG.seed, base];
    configItems.push(_.reduce(configVars,
            function(r, val, i) { return r + val * Math.pow(base, i) }));
    configItems.push(metalSpots);
    var configKey = _.map(configItems,
                          function(v) { return v.toString(16) }).join('-');
    console.log(configKey);
    model.asg_system_id(configKey);
}

function decodeSystemId() {
    var config = _.map(model.asg_system_id().split('-'),
                       function (v) { return parseInt(v, 16); });
    var seed = config[0];
    var base = config[1];
    var combined = config[2];
    var metalSpots = config[3];
    var slots = model.slots() || 2; // ignore spurious zero
    model.asg_metal_spots(Math.floor(metalSpots / slots));
    var config = _.map(_.range(9),
            function(i) { return Math.floor(combined/Math.pow(base,i)) % base });
    model.asg_large_planets(config[0]);
    model.asg_medium_planets(config[1]);
    model.asg_small_planets(config[2]);
    model.asg_tiny_planets(config[3]);
    model.asg_gas_giants(config[4]);
    model.asg_start_planets(config[5]);
    model.asg_launchable_planets(config[6]);
    model.asg_laser_planets(config[7]);
    var boolconf = config[8];
    var bools = _.map(_.range(2),
            function(i) { return Math.floor(boolconf/Math.pow(2,i)) % 2 });
    model.allowGameEnderStart(bools[0]);
    model.symmetricalStarts(bools[1]);
    return seed;
}

var generateSystem = function(seed) {
    if (seed == undefined) {
        seed = getRandomSeed();
    }
    ASG.seed = seed;
    encodeSystemId();

    var rng = new Math.seedrandom(seed);
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

    var nSlots = model.slots();
    var nLarge = parseInt(model.asg_large_planets());
    var nMedium = parseInt(model.asg_medium_planets());
    var nSmall = parseInt(model.asg_small_planets());
    var nTiny = parseInt(model.asg_tiny_planets());
	var nCustom = parseInt(model.asg_custom_planets());
	var radiusCustomMin = parseInt(model.asg_radiusCustomMin());
    var radiusCustomMax = parseInt(model.asg_radiusCustomMax());
    var nGas = parseInt(model.asg_gas_giants());
    var nStart = parseInt(model.asg_start_planets()); // small, medium, and large
    var nLaunch = parseInt(model.asg_launchable_planets()); // small and tiny
    var nLaser = parseInt(model.asg_laser_planets()); // r >= 500; large
    var metalSpots = parseInt(model.asg_metal_spots()) * nSlots;
    var allowGameEnderStart = model.allowGameEnderStart();
    var nAsteroid = parseInt(model.asg_asteroid());

    var rSystem = {
        name: 'Awesome System ' + model.asg_system_id(),
        isRandomlyGenerated: true,
        players: [nSlots, nSlots]
    };

    var specs = [];
    var specs2 = [];
    
    // Create Gas Giants
    for (var i = 0; i < nGas; i++) {
        specs.push({biome: ['gas'],
                    radius: getRandomInt(1000,1500),
                    mass: 50000,
                    temperature: getRandomInt(0,100),
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
	
	
	//initializing asteroids, randoming params
	var spawnMaxOneAsteroidOnStart = 0;
 
    for (var i=0; i < nAsteroid; i++) {
	var ran = getRandomInt(0,1);
	if(ran==1){
        specs2.push({biome: "asteroid",
                    radius: getRandomInt(100,200),
                    mass: 5000,
                    respawn: true,
                    starting_planet: false,
                    required_thrust_to_move: 1,
                    start_destroyed: true,
                    min_spawn_delay: getRandomInt(360,420),
                    max_spawn_delay: getRandomInt(421,600),
                    heightRange: 100,
                    waterHeight: 0,
                    waterDepth: 100,
                    temperature: 50,
                    metalDensity: 1,
                    metalClusters: 1,
                    metalSpotLimit: getRandomInt(-1,15),
                    biomeScale: 100,
                    numArmies: 2,
                    landingZonesPerArmy: 0,
                    landingZoneSize: 0});
    }
	else if (ran==0 && spawnMaxOneAsteroidOnStart==0){
	    specs2.push({biome: "asteroid",
                    radius: getRandomInt(100,200),
                    mass: 5000,
                    respawn: true,
                    starting_planet: false,
                    required_thrust_to_move: 1,
                    start_destroyed: false,
                    min_spawn_delay: getRandomInt(360,420),
                    max_spawn_delay: getRandomInt(421,600),
                    heightRange: 100,
                    waterHeight: 0,
                    waterDepth: 100,
                    temperature: 50,
                    metalDensity: 1,
                    metalClusters: 1,
                    metalSpotLimit: getRandomInt(-1,15),
                    biomeScale: 100,
                    numArmies: 2,
                    landingZonesPerArmy: 0,
                    landingZoneSize: 0});
		spawnMaxOneAsteroidOnStart+=1;
	}
    }

    // biome data; probabilities ordered (tiny, small, medium, large)
    var defaultHeightRange = [20, 50];
    var defaultWaterHeight = [33,35];
    var defaultTemp = [5, 95];

    biomes = [
        {biome:'earth',    probabilities: [ 0, 0,10,10], temperature: [15, 80], waterHeight: [20,50]}, //normal
        {biome:'earth',    probabilities: [ 0, 0, 3, 3], temperature: [15, 80], waterHeight: [55,60]}, // oceanic
        {biome:'earth',    probabilities: [ 5, 5, 2, 1], temperature: [0, 0]}, //ice
        {biome:'earth',    probabilities: [ 5, 5, 2, 1], waterHeight: [0, 20], temperature: [0,0]}, //ice/barren
        {biome:'desert',   probabilities: [ 0, 4,10,10], waterHeight: [25, 50]}, // normal
        {biome:'desert',   probabilities: [ 5, 7, 0, 0], waterHeight: [25, 30]}, // small
        {biome:'desert',   probabilities: [ 0, 0, 3, 3], waterHeight: [55,60]}, //oceanic
        {biome:'lava',     probabilities: [12,12, 7, 7], heightRange: [10,30]},
        {biome:'tropical', probabilities: [ 0 ,0,10,10], temperature: [15, 100], waterHeight: [20,50]}, // normal
        {biome:'tropical', probabilities: [ 5 ,5, 0, 0], temperature: [60, 100]}, // pure jungle
        {biome:'tropical', probabilities: [ 0 ,0, 3, 3], temperature: [15, 100], waterHeight: [55,60]}, // oceanic
        {biome:'moon',     probabilities: [10, 0, 0, 0], heightRange: [25,100]}, // tiny
        {biome:'moon',     probabilities: [ 0,10, 0, 0], heightRange: [20,50]}, // small
        {biome:'moon',     probabilities: [ 0, 0, 5, 0], heightRange: [10,40]}, // medium
        {biome:'metal',    probabilities: [10,15, 0, 0]}
    ];

    var sizes = [{size:'tiny', n:nTiny, m:5000, r1:100, r2:200},
                 {size:'small', n:nSmall, m:10000, r1:200, r2:350},
                 {size:'medium', n:nMedium, m:20000, r1:400, r2:800},
                 {size:'large', n:nLarge, m:40000, r1:800, r2:1200},
				 {size:'custom', n:nCustom, m:20000, r1:radiusCustomMin, r2:radiusCustomMax}];

    // Populate sizes and biomes for regular planets
    for (var j = 0; j < sizes.length; j++) {
        var cdf = [];
        var sum = 0;
        for (var i = 0; i < biomes.length; i++) {
            sum += biomes[i].probabilities[j];
            cdf.push(sum);
        }
        for (var i = 0; i < sizes[j].n; i++) {
            var B = biomes[getChoice(cdf)];
            specs.push({
                biome: [B.biome],
                mass: sizes[j].m,
                radius: getRandomInt(sizes[j].r1, sizes[j].r2),
                size: sizes[j].size,
                temperature: getRandomInt(B.temperature || defaultTemp),
                heightRange: getRandomInt(B.heightRange || defaultHeightRange),
                waterHeight: getRandomInt(B.waterHeight || defaultWaterHeight)
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

    var nAvailable = nSmall + nMedium + nLarge + nCustom;
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
    var nLeft = nStart;
    while (nLeft) {
        var i = getRandomInt(0, specs.length-1);
        if ((specs[i].start) ||
            (specs[i].biome[0] == 'gas') ||
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
        {planet: -1, children: [], weight: 3, capacity: 4, maxMass: 1e5},
        {planet: -1, children: [], weight: 2, capacity: 4, maxMass: 1e5},
        {planet: -1, children: [], weight: 1, capacity: 4, maxMass: 1e5},
        {planet: -1, children: [], weight: 0, capacity: 4, maxMass: 1e5}];

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

    // Orbits with 3 planets are not allowed, to avoid the cases where the game
    // decides to teleport planets to different spots along their orbits. Move
    // planets from 3-planet orbits to orbits that currently have 0, 1, or 3
    // planets.
    for (var j = 0; j < orbits.length; j++) {
        var orbit = orbits[j];
        if (orbit.planet != -1) {
            break;
        }
        if (orbit.children.length == 3) {
            for (var k = j+1; k < orbits.length; k++) {
                var neworbit = orbits[k];
                if (neworbit.planet != -1) {
                    console.log("Orbit reassignment failed!", orbits);
                    break;
                }
                if (neworbit.children.length == 0 ||
                    neworbit.children.length == 1 ||
                    neworbit.children.length == 3) {
                    var spec_id = orbit.children.pop();
                    console.log("Reassigning", spec_id, "from", j, "to", k);
                    specs[spec_id].orbit = neworbit;
                    neworbit.children.push(spec_id);
                    break;
                }
            }
        }
    }

    // Remove any empty orbits:
    orbits = _.filter(orbits, function(orbit) { return orbit.children.length; });

    // Stupid hack to prevent unintended capture: Set mass for all primary
    // planets to be equal (and large), and set mass of all secondary planets to
    // be equal (and smaller)
    for (var j = 0; j < orbits.length; j++) {
        var orbit = orbits[j];
        if (orbit.planet == -1) {
            for (var i = 0; i < orbit.children.length; i++) {
                specs[orbit.children[i]].mass = 50000;
            }
        } else {
            for (var i = 0; i < orbit.children.length; i++) {
                specs[orbit.children[i]].mass = 40000;
            }
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

    var metal0 = 0;
    var metalC = 0;
    var metalD = 0;
    var metalRCD = 0;
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

        metal0 += 15.84;
        metalC += 0.1996*spec.metalClusters;
        metalD += 0.3633*spec.metalDensity;
        metalRCD += 1.321e-5*spec.radius*spec.metalClusters*spec.metalDensity;
    }

    // Scale density to get closer to the desired number of metal spots
    var scaleD = (metalSpots - metal0 - metalC)/(metalD + metalRCD);
    scaleD = clip(scaleD, 0.2, 3.0);

    // Scale clusters if that wasn't enough
    var scaleC = (metalSpots - metal0 - metalD*scaleD) / (metalC + metalRCD*scaleD);
    scaleC = clip(scaleC, 0.2, 3.0);

    var metalEstimate = 0;
    for (var i = 0; i < specs.length; i++) {
        var spec = specs[i];
        if (spec.biome[0] == 'gas') {
            spec.metalEstimate = 0;
            continue;
        }
        spec.metalDensity = Math.floor(clip(spec.metalDensity*scaleD, 0, 100));
        spec.metalClusters = Math.floor(clip(spec.metalClusters*scaleC, 0, 100));
        if (spec.start) {
            // Still want at least one metal spot per landing zone
            spec.metalClusters = Math.max(25, spec.metalClusters);
        }
        spec.metalEstimate = Math.floor(15.84 + 0.1996*spec.metalClusters +
                                        0.3633*spec.metalDensity +
                                        1.321e-5*spec.radius*spec.metalClusters*spec.metalDensity);
        metalEstimate += spec.metalEstimate;
    }
    var planets = [];

    //  Assign positions and velocities to all the planets; set up data used for
    //  planet generation
    for (var j = 0; j < orbits.length; j++) {
        var orbit = orbits[j];
        var N = orbit.children.length;
        var theta = getRandomInt(0, 3) * Math.PI / 2;

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
            var symmetrical = model.symmetricalStarts() && child.start;

            planets[spec_index[orbit.children[i]]] = {
                mass: child.mass,
                intended_radius: child.radius,
                position_x: child.position[0],
                position_y: child.position[1],
                velocity_x: child.velocity[0],
                velocity_y: child.velocity[1],
                starting_planet: child.start,
                required_thrust_to_move: getRandomInt(child.launch || [0, 0]),
                metalEstimate: child.metalEstimate,
                planet: {
                    //index: spec_index[orbit.children[i]],
                    seed: getRandomInt(0, 32767),
                    biome: child.biome[0],
                    radius: child.radius,
                    heightRange: child.heightRange,
                    waterHeight: child.waterHeight,
                    waterDepth: 50,
                    temperature: child.temperature,
                    biomeScale: 100,
                    metalDensity: child.metalDensity,
                    metalClusters: child.metalClusters,
                    landingZoneSize: 0,
                    landingZonesPerArmy: (model.singleLandingZone()) ? 1 : 0,
                    numArmies: 2,
                    symmetricalMetal: symmetrical,
                    symmetricalStarts: symmetrical,
                    symmetryType: (symmetrical) ? "terrain and CSG" : "none"
                }
            };
        }
        
		//code resposible for adding asteroids, hardcoded values because math is hard :/
        for (var i = 0; i < nAsteroid; i++) {
            var child = specs2[i];
            if(i==0) {
                child.position_x=0;
                child.position_y=30000;
                child.velocity_x=-91.28709411621094;
                child.velocity_y=-0.000003990285676991334;
            } else if(i==1) {
                child.position_x=0;
                child.position_y=-30000;
                child.velocity_x=91.28709411621094;
                child.velocity_y=0.000003990285676991334;
            } else if(i==2) {
                child.position_x=30000;
                child.position_y=0;
                child.velocity_x=-0.000003990285676991334;
                child.velocity_y=91.28709411621094;
            }

            planets[spec_index.length+i] = {
                mass: child.mass,
                intended_radius: child.radius,
                position_x: child.position_x,
                position_y: child.position_y,
                velocity_x: child.velocity_x,
                velocity_y: child.velocity_y,
                starting_planet: child.start,
                start_destroyed: child.start_destroyed,
				respawn: child.respawn,
                required_thrust_to_move: child.required_thrust_to_move,
                min_spawn_delay: child.min_spawn_delay,
                max_spawn_delay: child.max_spawn_delay,                
                planet: {
                    //index: spec_index[orbit.children[i]],
                    seed: getRandomInt(0, 32767),
                    biome: child.biome,
                    radius: child.radius,
                    heightRange: child.heightRange,
                    waterHeight: child.waterHeight,
                    waterDepth: 50,
                    temperature: child.temperature,
                    biomeScale: 100,
                    metalDensity: child.metalDensity,
                    metalClusters: child.metalClusters,
                    metalSpotLimit: child.metalSpotLimit,
                    landingZoneSize: 0,
                    landingZonesPerArmy: 0,
                    numArmies: 2,
                    symmetricalMetal: false,
                    symmetricalStarts: false,
                    symmetryType: "none"
                }
            };
        }
        
        
        
    }

    // Debug printing
    console.log('*****************************************');
    for (var j = 0; j < orbits.length; j++) {
        console.log('orbit', j, orbits[j].planet, orbits[j].radius,
                    orbits[j].children);
    }
    console.log('---');
    for (var j = 0; j < planets.length; j++) {
        var plnt = planets[j];
        console.log('planet', j, planet_order[j], plnt.mass, plnt.planet.radius,
            plnt.position_x, plnt.position_y, plnt.velocity_x, plnt.velocity_y);
    }

    // First, model.system will be set to what we say here. The next time it is
    // set will be when the server returns the "validated" system configuration.
    ASG.verifyCount = 2;

    // build the planets
    var pgen = _.map(planets, function(plnt, index) {
        var biomeGet = $.getJSON('coui://pa/terrain/' + plnt.planet.biome + '.json')
            .then(function(data) {
                return data;
            });
        var nameGet = $.Deferred();
        api.game.getRandomPlanetName().then(function(name) { nameGet.resolve(name); });
        return $.when(biomeGet, nameGet).then(function(biomeInfo, name) {
            plnt.name = name;
            return plnt;
        });
    });

    return $.when.apply($, pgen).then(function() {
        rSystem.planets = Array.prototype.slice.call(arguments, 0);
        return rSystem;
    });
};

function verifySystemConfig(system) {
    // The server's "validation" will sometimes reset the radii of small metal
    // planets (r < 500, with no annihilaser) even though they work just fine.
    // If this happens, try generating the system again (using the same seed).
    if (!ASG.verifyCount) {
        return;
    }
    ASG.verifyCount -= 1;
    if (ASG.verifyCount) {
        return;
    }

    var needsRegeneration = false;
    for (var i = 0; i < system.planets.length; i++) {
        if (system.planets[i].planet.radius != system.planets[i].intended_radius) {
            console.log('Forcing system regeneration');
            needsRegeneration = true;
            break;
        }
    }
    if (!needsRegeneration) {
        console.log("System config is OK");
    }
    if (needsRegeneration && ASG.failureCount < 4) {
        ASG.failureCount++;
        model.generateAwesomeSystem(model, undefined, ASG.seed);
    } else {
        ASG.failureCount = 0;
        if (needsRegeneration) {
            // Give up and regenerate with a new random seed
            model.generateAwesomeSystem(model);
        }
    }
}

$(function () {
    $('head').append('<link rel="stylesheet" href="coui://ui/mods/awesomeSystemGenerator/asg.css" type="text/css" />');
    var options = $('.system-options');
    var controls = $('<div id="ap-controls" data-bind="visible: canChangeSettings"></div>');
    options.prepend(controls);
    var button = $(
        '<div class="btn_std_gray new_system" data-bind="click: generateAwesomeSystem">' +
        '<div class="btn_std_label">New Awesome System</div></div>');
    controls.append(button);
    ko.applyBindings(model, controls[0]);

    var table = $('<table></table>');
    controls.append(table);

    var makeButton = function(label, clickFunction) {
        var outer = ($('<div class="asg-button"></div>')
                        .attr('data-bind', 'click: ' + clickFunction));
        var inner = $('<div class="btn-asg-label"></div>').text(label);
        outer.append(inner);
        return outer;
    }
    model.adjustVariable = function(observable, delta, min, max) {
        var v = model[observable];
        v(clip(v() + delta, min, max));
    }

    var addControl = function(id, label, value, delta, min, max) {
        id = 'asg_' + id;
        model[id] = ko.observable(value);

        var tr = $('<tr></tr>');
        tr.append($('<td class="asg asg-label">' + label + ':</td>'));
        var td = $('<td class="asg"></td>');
        tr.append(td);
        var i = $('<input type="text" class="asg-input-value">');
        i.attr('data-bind', 'value: ' + id);
        td.append(i);
        if (delta != undefined) {
            td.append(makeButton('-', 'adjustVariable.bind($data, "'+ id + '",' +
                                      -delta + ',' + min + ',' + max + ')'));
            td.append(makeButton('+', 'adjustVariable.bind($data, "'+ id + '",' +
                                      delta + ',' + min + ',' + max + ')'));
        }
        table.append(tr);
        ko.applyBindings(model, tr[0]);
        model[id].subscribe(encodeSystemId);
    }

    addControl('large_planets', 'Large Planets', 0, 1, 0, 16);
    addControl('medium_planets', 'Medium Planets', 0, 1, 0, 16);
    addControl('small_planets', 'Small Planets', 0, 1, 0, 16);
    addControl('tiny_planets', 'Tiny Planets', 0, 1, 0, 16);
	addControl('custom_planets', 'Custom Planets', 0, 1, 0, 16);
	addControl('radiusCustomMin', 'Min Radius', 50, 50, 50, 1200);
    addControl('radiusCustomMax', 'Max Radius', 150, 50, 50, 1200);
    addControl('gas_giants', 'Gas Giants', 0, 1, 0, 16);
    addControl('start_planets', 'Start Planets', 0, 1, 1, 16);
    addControl('launchable_planets', 'Launchable Planets', 0, 1, 0, 16);
    addControl('laser_planets', 'Annihilaser Planets', 0, 1, 0, 16);
    addControl('metal_spots', 'Metal Spots Per Player', 10, 10, 10, 500);
    addControl('asteroid', 'Asteroid Count', 0, 1, 0, 3);

    // "Load System"
    model.asg_system_id = ko.observable('');
    var tr = $('<tr></tr>');
    tr.append($('<td class="asg asg-label">System ID:</td>'));
    var td = $('<td class="asg"></td>');
    tr.append(td);
    var i = $('<input type="text" class="asg-system-id">');
    i.attr('data-bind', 'value: asg_system_id');
    td.append(i);
    table.append(tr);
    td.append(makeButton('load', 'generateSystemFromId'));
    ko.applyBindings(model, tr[0]);

    var addCheckbox = function(name, label, defaultValue) {
        var L = $('<label data-bind="click: toggle_' + name + '"></label>');
        L.append($('<input type="checkbox" style="pointer-events: none !important;" data-bind="checked: '+name+', enable: canChangeSettings">'));
        L.append(' ' + label);
        controls.append(L);

        model[name] = ko.observable(defaultValue);
        model['toggle_'+name] = function() {
            model[name](!model[name]());
            encodeSystemId();
        }
        ko.applyBindings(model, L[0]);
    }

    addCheckbox('allowGameEnderStart', 'Allow start planets with game enders', false);
    addCheckbox('symmetricalStarts', 'Symmetrical starting planets ', false);
    addCheckbox('singleLandingZone', 'Single landing zone per planet & player', false);
    model.system.subscribe(verifySystemConfig);
    encodeSystemId();
});
