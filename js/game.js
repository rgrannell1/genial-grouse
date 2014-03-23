
;( function() {
	"use strict"
} )()

var can = document.getElementById("canvas")
var ctx = can.getContext("2d")

const always = ( function () {
	/*
		Contract functions.
		Return a value if it meets criteria, otherwise throws an error.
	*/

	const checkThat = (predicate, type) => {
		return val => {
			if (predicate(val)) {
				return val
			} else {
				throw new TypeError(
					"The contract always." + type + " was broken with the value " + val + ".\n" +
					"Calling function was " + arguments.callee.caller.toString() + ".\n")
			}
		}
	}

	return {
		'whole':
			checkThat(val => {
				return val === val && val % 1 === 0
			}, 'whole'),
		'numeric':
			checkThat(val => {
				return val === val
			}, 'numeric'),
		'boolean':
			checkThat(val => {
				return val === false || val === true
			}, 'boolean'),
		'func':
			checkThat(val => {
				return val && typeof val === 'function'
			}, 'function')
	}

} )()




const constants = ( function () {
	/*
		This module contains most of the arbitrary constants used
		in the game, including some translation functions.
	*/

	var self = {}

	self.step = 1

	self.dx = 1.4
	self.birdDx = 0.75
	self.epsilon = 0.000001

	self.cloudInterval = .3

	self.cloud = {
		width: 140,
		height: 140 / Math.pow(1.613, 3)
	}

	self.bounds = {
		x0: -self.cloud.width,
		x1: can.width + self.cloud.width,
		y0: -50,
		y1: can.height + 50,
	}

	self.gravity = 9.8 / 60,

	self.colours = {
		blue: "#3498db",
		white: "#ecf0f1",
		black: "black"
	}

	self.hero = {
		width: 32,
		height: 32
	}

	self.score = {
		x0: 100,
		y0: 50
	}
	self.frameTime =
		1 / 60

	self.asMagnitude =
		(interval) => {
			return 5.5  * Math.log(interval / 25)
		}

	self.asVelocity =
		velocity => {
			const terminalVelocity = 8

			if (velocity > 0) {
				return Math.min(velocity, terminalVelocity)
			} else {
				return Math.max(velocity, -terminalVelocity)
			}
		}

	self.cloudBounds = {
		y0: 0.150,
		y1: 0.875
	}

	return self
} )()

const utils = ( function () {

	var self = {}

	self.getTime = () => {
		return (new Date).getTime()
	}

	self.timer = interval => {

		const genesis = self.getTime()

		return function () {
			always.boolean(self.getTime() > (genesis + interval))
		}
	}

	self.isEmpty = obj => {
		for (var prop in obj) {
			if (obj.hasOwnProperty(prop)) {
				return false
			}
		}
		return true
	}

	self.trueWithOdds =	prob => {
		return always.numeric(Math.random() < prob)
	}

	self.randBetween = (lower, upper) => {
		return always.numeric((Math.random() * (upper-lower)) + lower)
	}

	self.flatmap = (coll, fn) => {

		var out = []

		for (var ith = 0; ith < coll.length; ith++) {
			out = out.concat( fn(coll[ith]) )
		}

		return out
	}

	self.solve = (a, b, c) => {
		// solve an equation of the form at^2 + vt + c = 0

		const _ = undefined

		const match = (triplesList) => {
			/*
				Pattern match an array against a pattern array where
				undefined acts as a wildcard, and return the matching response.
			*/

			var matchedResponse;
			const args = Array.prototype.slice.call(arguments)

			for (var tripleIth = 0; tripleIth < args.length; tripleIth++) {

				var triple = args[tripleIth]

				const values   = triple[0]
				const pattern  = triple[1]
				const response = triple[2]

				var allMatches = true

				for (var ith = 0; ith < values.length; ith++) {
					allMatches = allMatches && (pattern[ith] === _ || values[ith] === pattern[ith])
				}

				if (allMatches) {
					return always.func(response)
				}
			}
		}

		const solver = match(
			[[a, b, c], [0, 0, 0], (a, b, c) => {
				// infinitely many solutions.
				return []
			}],
			[[a, b, c], [0, 0, _], (a, b, c) => {
				// no solutions solutions.
				return []
			}],

			[[a, b, c], [0, _, _], (a, b, c) => {
				// linear-equation.

				return [c / b, c / b]
			}],

			[[a, b, c], [_, 0, 0], (a, b, c) => {
				// only the second-order term.

				return [0]
			}],

			[[a, b, c], [_, _, _], (a, b, c) => {
				// the quadratic formula; the most general case.

				console.assert(a * b * c !== 0)

				const inner = Math.abs(b * b - 4 * a * c)
				const denominator = 2*a

				if (inner < 0) {
					return []
				} else {
					return [
						always.numeric(
							(-b + Math.sqrt(inner)) / denominator),
						always.numeric(
							(-b - Math.sqrt(inner)) / denominator)
					]
				}
			}]
		)

		always.numeric(a)
		always.numeric(b)
		always.numeric(c)

		return solver(a, b, c)
	}

	self.asCanvasMouseCoords =
		(x, y) => {
			return {
				x: always.numeric(x - can.offsetLeft),
				y: always.numeric(y - can.offsetTop)
			}
		}

	return self

} )()

const motion = ( function () {

	var self = {}

	self.flying = self => {
		return (step, reflect = false) => {
			/*

			*/
			if (reflect) {
				return self
			} else {
				return {
					x0: always.numeric(self.x0 + self.vx*step),
					x1: always.numeric(self.x1 + self.vx*step),

					y0: always.numeric(self.y0 + 7 * Math.sin(step / 30)),
					y1: always.numeric(self.y1 + 7 * Math.sin(step / 30))
				}
			}
		}
	}

	self.standing = self => {
		return (step, reflect = false) => {
			/*

			*/

			if (reflect) {
				return self
			} else {
				return {
					x0: always.numeric( self.x0 - (self.vx * (step - self.init)) ) ,
					x1: always.numeric( self.x1 - (self.vx * (step - self.init)) ) ,

					y0: always.numeric(self.y0) ,
					y1: always.numeric(self.y1)
				}
			}
		}
	}

	self.falling = self => {
		return (step, reflect = false) => {
			/*
				given an initial v→ generate a function giving
				the players position at a given step. This closed form
				makes it easier to raycast collisions.
			*/

			if (reflect) {
				return self
			} else {
				const time = step - self.init

				return {
					x0: always.numeric(self.x0 + self.vx * time + 0.5 * self.ax * (time * time)),
					x1: always.numeric(self.x1 + self.vx * time + 0.5 * self.ax * (time * time)),

					y0: always.numeric(self.y0 + self.vy * time + 0.5 * self.ay * (time * time)),
					y1: always.numeric(self.y1 + self.vy * time + 0.5 * self.ay * (time * time))
				}
			}
		}
	}

	self.cloud = self => {
		return (step, reflect = false) => {

			if (reflect) {
				return self
			} else {
				return {
					x0: always.numeric( constants.bounds.x1 - (constants.dx * (step - self.init)) ),
					x1: always.numeric( constants.bounds.x1 - (constants.dx * (step - self.init)) + constants.cloud.width ),

					y0: always.numeric(self.y0),
					y1: always.numeric(self.y1)

				}
			}
		}
	}

	return self

} )()


// the initial state

var state = ( function () {
	/*
		The initial game state. All fields that
		should be present are present from the start.
	*/

	var self = {}

	self.cloudTimer = function () {
		return true
	}

	self.clouds = []
	self.hero = {
		position: motion.flying({
			x0: 10,
			x1: 10 + constants.hero.width,

			y0: constants.cloudBounds.y0 + 50 ,
			y1: constants.cloudBounds.y0 + 50 + constants.hero.height,

			vx: constants.birdDx,
			vy: 0
		}),

		isDead:
			false,

		positionType:
			'flying',

		lastCloud:
			-1,

		angle:
			0,

		jumps: {

		}
	}

	// reactions are temporally ordered.
	self.reactions = []
	self.collisions = {}

	self.score = 0
	self.nextCloud = 0
	self.step = 0

	return self

} )()



const react = ( function () {
	/*
		This module returns 'setters' for the game state. Each function
		herein takes a part of the game state, and modifies it. They don't usually
		test if the state should be modified - that task falls on update and currently.
	*/

	return {
		addClouds:
			state => {

				state.clouds = state.clouds.concat( ( function () {

					const init = state.step

					const y0 = utils.randBetween(
						0.150 * constants.bounds.y1 - constants.hero.height - 10,
						0.875 * constants.bounds.y1)

					const y1 = y0 + constants.cloud.height

					return {
						position: motion.falling({
							x0: constants.bounds.x1,
							x1: constants.bounds.x1 + constants.cloud.width,
							y0: always.numeric(y0),
							y1: always.numeric(y1),

							vx: -constants.dx,
							vy: 0,

							ax: 0,
							ay: 0,

							init: always.whole(state.step)
						}),
						cloudId: always.whole(state.nextCloud)
					}

				} )() )

				state.nextCloud = always.whole(state.nextCloud + 1)

				return state
			},
		removeOldClouds:
			state => {
				/*
					Remove the cloud functions that - at the current
					timestep - are offscreen.
				*/

				state.clouds = state.clouds.filter(function (cloud) {
					return always.boolean(cloud.position(state.step).x0 > constants.bounds.x0)
				})

				return state
			},

		clipWings:
			state => {
				/*
					Swap the initial flying sin-wave motion function for a
					falling motion function.
				*/

				var hero = state.hero

				if (hero.positionType === "flying") {
					hero.positionType = 'falling'

					const coords = hero.position(state.step)

					const ySlope = ( function () {

						const coords1 = hero.position(state.step + constants.epsilon)

						return (coords.y1 - coords1.y1) / (coords.x1 - coords1.x1)
					} )()

					hero.position = always.func( motion.falling({
						x0: coords.x0,
						x1: coords.x1,
						y0: coords.y0,
						y1: coords.y1,

						vx: constants.birdDx,
						vy: ySlope,

						ax: 0,
						ay: constants.gravity,

						init: state.step
					}) )
				}

				state.hero = hero

				return state
			},
		enqueueCollisions:
			state => {
				/*
				Every moving object in the game has a trajectory function.
				Because of this collisions can easily be found before they happen;
				the player trajectory function and each cloud trajectory function can
				be used to checked to see if they intersect at any point.

				If an interection between the player and cloud is found in the future,
				then the player either rebounds (1.), lands on the platform (2.), or


				1, Rebounds. The x component of the birds velocity is reversed.
				2, Lands. The y component of the acceleration and velocities are set
					to zero, and the x component is set to the scroll speed dx.
				3, Falls into oblivion. The trajectory is kept.
				*/

				/*
					for each cloud:
						find the t' that the trajectory shares the same y position as the cloud
						using the quadratic equation.

						If t' isnt in the right range next.

						get the [x0, x1, y0, y1 of the function at this time.
						if


						.5 at ^2 + vt- constant = 0


				*/


				var hero = state.hero

				if (hero.positionType !== 'falling') {
					return state
				}
				console.log('Queueing!')

				const futureCollisions = utils.flatmap(state.clouds, cloud => {
					/*
						for each cloud check at what time
						the player shares its y position with the cloud.
					*/

					var comps = {
						ay:
							-always.numeric(constants.gravity),
						vy:
							always.numeric(hero.position(0, true).vy),
						c:
							always.numeric(cloud.position(0).y0)
					}

					const times = utils.solve(comps.ay, comps.vy, comps.c)

					if (times.length === 0) {
						return []
					}

					// the positive solution is the future intersection point.
					const t = always.numeric(Math.max.apply(Math, times)) + state.step

					// sort out the solutions for the

					var future = {
						hero: hero.position(t),
						cloud: cloud.position(t)
					}

					// if, when the y axis intersects, the x intersects


					const xRegion = ( function () {
						/*
							is the bird?
							1, not touching and to the left
							2, touching and to the left,
							3, intersecting
							4, toughing and to the right
							5, not touching and to the right.
						*/



					} )()


					const yRegion = ( function () {
						/*
							is the bird?
							1, not touching and above
							2, touching and above,
							3, intersecting
							4, toughing and below
							5, not touching and below.
						*/

					} )()


					const isAlignedX =
						future.hero.x1 > future.cloud.x0 && future.hero.x0 < future.cloud.x1

					const isAlignedXLeft =
						Math.abs(future.hero.x1 - future.cloud.x0) < 2

					const isAlignedYMiddle =
						future.hero.y1 > future.cloud.y0 && future.hero.y0 < future.cloud.y1

					const isAlignedYTop =
						Math.abs(future.hero.y1 - future.cloud.y0) < 6

					const isAlignedYBottom =
						Math.abs(future.hero.y0 - future.cloud.y1) < 6

					if (isAlignedX && isAlignedYTop) {
						return [{
							position: motion.falling({
								x0: future.hero.x0,
								x1: future.hero.x1,
								y0: cloud.position(t).y0 - constants.hero.height,
								y1: cloud.position(t).y0,

								vx: -constants.dx,
								vy: 0,

								ax: 0,
								ay: 0,

								init: Math.floor(t),
							}),
							step: Math.floor(t),
							positionType: 'standing',
							cloudId: cloud.cloudId
						}]
					} else if (isAlignedX && isAlignedYBottom) {

						const reflected = hero.position(t, true)

						return [{
							position: motion.falling({
								x0: future.hero.x0,
								x1: future.hero.x1,
								y0: cloud.position(t).y1,
								y1: cloud.position(t).y1 + constants.hero.height,

								vx: reflected.vx,
								vy: -reflected.vy,

								ax: reflected.ax,
								ay: reflected.ay,

								init: Math.floor(t)
							}),
							step: Math.floor(t),
							positionType: 'falling',
							cloudId: cloud.cloudId
						}]
					} else if (isAlignedXLeft && isAlignedYMiddle) {
						console.log("hit")
					}

					return []

				})

				// change!
				if (futureCollisions.length > 0) {
					state.collisions = futureCollisions[0]
				}

				return state
			},
		alterCourse:
			state => {
				/*
					The pre-calculated collision point has
					been reached, so we need to swap out
					the current player's motion function forst
					the pre-computed motion function.
				*/

				var hero = state.hero
				var collision = state.collisions

				hero.position = collision.position
				hero.positionType = collision.positionType

				if (hero.lastCloud !== collision.cloudId) {
					state.score = state.score + 1
					hero.lastCloud = collision.cloudId
				}

				state.collisions = []
				state.hero = hero

				return state
			},
		endGame:
			state => {
				/*
					The game is over.
				*/

				state.hero.isDead = true

				return state
			},
		beginJumpPowerup:
			time => {
				return state => {
					/*
						register that we are getting ready to jump.
					*/

					var hero = state.hero

					if (hero.positionType === 'standing' || hero.positionType === "falling") {
						hero.jumps = {
							'time': time
						}
					}
					state.hero = hero

					return state
				}
			},
		jump:
			(x, y, time) => {
				return state => {

					var hero = state.hero

					if (hero.positionType !== "standing") {
						return state
					}

					const holdDuration = time - hero.jumps.time

					const heroCoords = hero.position(state.step)

					var mouse = utils.asCanvasMouseCoords(x, y)

					var dist = {
						x: Math.abs(always.numeric(mouse.x - heroCoords.x1)),
						y: -Math.abs(always.numeric(mouse.y - heroCoords.y1))
					}

					var angle = Math.atan(dist.y / dist.x)

					var velocities = {
						x:
							Math.min((holdDuration * Math.cos(angle)) / 30, 11),
						y:
							Math.min((holdDuration * Math.sin(angle)) / 30, 11)
					}

					hero.position = motion.falling({
						x0: heroCoords.x0,
						x1: heroCoords.x1,
						y0: heroCoords.y0,
						y1: heroCoords.y1,

						vx: always.numeric(velocities.x),
						vy: always.numeric(velocities.y),

						ax: 0,
						ay: constants.gravity,

						init: always.whole(state.step)
					})

					hero.positionType = 'falling'
					hero.jumps = {}

					state.hero = hero

					return state
				}
			},
		setAngle:
			(x, y) => {
				return state => {

					var hero = state.hero
					const mouse = utils.asCanvasMouseCoords(x, y)
					const heroCoords = hero.position(state.step)

					var dist = {
						x: always.numeric(mouse.x - heroCoords.x1),
						y: always.numeric(mouse.y - heroCoords.y1)
					}

					if (dist.y === 0) {
						var angle = 0
					} else {
						var angle = -Math.atan2(dist.x, dist.y) - (270) * 3.14/180
					}

					hero.angle = angle
					state.hero = hero

					return state
				}
			}

	}
})()

const currently = ( function () {
	/*
		This module returns predicates that inspect the
		current state. These are currently used in the drawing
		and updating modules.
	*/

	return {
		isCloudy:
			state => {
				return state.clouds.length > 0
			},
		noFutureCollisions:
			state => {
				return utils.isEmpty(state.collisions)
			},
		cloudIsReady:
			state => {
				return state.step % 100 === 0
			},
		offscreen:
			state => {

				const coords = state.hero.position( state.step )

				const isOffscreen = coords.y1 > constants.bounds.y1 ||
					coords.x0 < constants.bounds.x0 ||
					coords.x1 > constants.bounds.x1

				return isOffscreen
			},
		flying:
			state => {
				return state.hero.positionType === 'flying'
			},
		falling:
			state => {
				return state.hero.positionType === 'falling'
			},
		notFalling:
			state => {
				return state.hero.positionType !== 'falling'
			},

		colliding:
			state => {
				return !utils.isEmpty(state.collisions) && state.collisions.step <= state.step
			},

		isDead:
			state => {
				return state.hero.isDead
			},
		isAlive:
			state => {
				return !state.hero.isDead
			}
	}

} )()

var update = ( function () {
	/*
		This module returns a function that - given the
		game state at state.step - returns the state at state.step + 1
	*/

	return state => {

		const when = (condition, reaction) => {
			// side-effectfully update state

			if (condition(state)) {
				state.reactions = state.reactions.concat([reaction])
			}
		}

		when(currently.cloudIsReady, react.addClouds)

		when(currently.isCloudy, react.removeOldClouds)

		when(currently.offscreen, react.endGame)

		when(currently.noFutureCollisions, react.enqueueCollisions)

		when(currently.colliding, react.alterCourse)

		/*
			consume every event in the queue, in order.
		*/

		for (var ith = 0; ith < state.reactions.length; ith++) {
			var reaction = state.reactions[ith]

			if (reaction) {
				state = always.func(reaction)(state)
			}
		}

		state.reactions = []
		state.step = always.whole(state.step + 1)

		return state
	}

} )()

const draw = ( function () {
	/*
		This module returns a function that handles all canvas
		drawing for the game.
	*/

	const render = {
		cloud:
			state => {

				ctx.fillStyle = constants.colours.white

				state.clouds.forEach(cloud => {

					var coords = cloud.position(state.step)

					ctx.fillRect(coords.x0, coords.y0, constants.cloud.width, constants.cloud.height)
				})
			},
		hero:
			state => {

				const hero = state.hero
				const birdy = document.getElementById("bird-asset")

				if (hero.jumps.time) {
					ctx.fillStyle = constants.colours.black
				} else {
					ctx.fillStyle = constants.colours.white
				}

				const coords = hero.position(state.step)

				if (hero.positionType === "standing") {

					var angle = hero.angle

				} else {

					const coords1 = hero.position(state.step + 0.01)

					const dist = {
						x: coords.x0 - coords1.x0,
						y: coords.y0 - coords1.y0
					}

					if (dist.y === 0) {
						var angle = 0
					} else {
						var angle = -Math.atan2(dist.x, dist.y) + (270) * 3.14/180
					}
				}

				coordsPrime = {
					x0:  Math.cos(angle) * coords.x0 + Math.sin(angle) * coords.y0,
					y0: -Math.sin(angle) * coords.x0 + Math.cos(angle) * coords.y0
				}


				ctx.save();

				ctx.rotate(angle)

				ctx.drawImage(birdy, coordsPrime.x0, coordsPrime.y0)
				ctx.restore();

				ctx.fillStyle = 'rgba(0,0,0,0.3)'
				ctx.fillRect(
					coords.x0, coords.y0,
					constants.hero.width, constants.hero.height
				)
			},
		score:
			state => {
				// draw the score to the corner of the screen.

				ctx.font = "30px Monospace"

				ctx.fillText(
					state.score + "",
					constants.score.x0, constants.score.y0)

			},
		deathScreen:
			state => {

				ctx.fillStyle = 'rgba(0,0,0,0.6)'

				ctx.fillRect(
					constants.bounds.x0, constants.bounds.y0,
					constants.bounds.x1, constants.bounds.y1)

				ctx.fillStyle = constants.colours.blue

				ctx.fillRect(
					constants.bounds.x0, 200,
					constants.bounds.x1, 100)

				ctx.font = "20px Monospace"

				ctx.fillStyle = constants.colours.white

				value = state.score

				ctx.fillText(
					"You ran out of cluck. " +
					"Score: " + state.score,
					constants.score.x0, 265)
			}
	}

	return state => {

		const when = (condition, reaction) => {
			// side-effectfully update state.

			if (condition(state)) {
				reaction(state)
			}
		}
		can.width = can.width

		when(currently.isCloudy, render.cloud)
		when(currently.isDead, render.deathScreen)
		when(currently.isAlive, render.score)
		when(currently.isAlive, render.hero)
	}

} )()






;( function () {
	/*
		This module attaches event listeners to the canvas.
	*/

	const upon = function (event, response) {
		//

		can.addEventListener(event, event => {
			state.reactions = state.reactions.concat([ response(event) ])
		})
	}

	upon('mousedown', event => {

		if (state.hero.positionType === "flying") {
			return react.clipWings
		} else {
			return react.beginJumpPowerup(utils.getTime())
		}
	})

	upon('mouseup', event => {

		return react.jump(
			event.pageX, event.pageY, utils.getTime())
	})

	upon('mousemove', event => {
		return react.setAngle(event.pageX, event.pageY)
	})

} )()

;( function () {
	/*
		This module contains the main game loop, and
		the code that ends the game.
	*/

	const loop = function () {
		/*
			repeatedly update the state.
		*/

		if (!state.hero.isDead) {
			state = update(state);
			draw(state)
		} else {
			clearInterval(GAMEID)
		}
	}

	const GAMEID = setInterval(loop, 1000 / 60)

} )()
