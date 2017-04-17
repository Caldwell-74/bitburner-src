/* Evaluator
 * 	Evaluates the Abstract Syntax Tree for Netscript
 *  generated by the Parser class
 */
// Evaluator should return a Promise, so that any call to evaluate() can just
//wait for that promise to finish before continuing
function evaluate(exp, workerScript) {
	var env = workerScript.env;
    switch (exp.type) {
		case "num":
		case "str":
		case "bool":
			return new Promise(function(resolve, reject) {
				if (env.stopFlag) {reject(workerScript);}
				resolve(exp.value);
			});
			break;
		case "var":
			return new Promise(function(resolve, reject) {
				if (env.stopFlag) {reject(workerScript);}
				try {
					resolve(env.get(exp.value));
				} catch (e) {
					throw new Error("|" + workerScript.serverIp + "|" + workerScript.name + "|" + e.toString());
				}
			});
			break;
		//Can currently only assign to "var"s
		case "assign":
			console.log("Evaluating assign operation");
			return new Promise(function(resolve, reject) {
				if (env.stopFlag) {reject(workerScript);}
				
				if (exp.left.type != "var")
					throw new Error("|" + workerScript.serverIp + "|" + workerScript.name + "| Cannot assign to " + JSON.stringify(exp.left));
				
				var p = new Promise(function(resolve, reject) {
					setTimeout(function() { 
						var expRightPromise = evaluate(exp.right, workerScript);
						expRightPromise.then(function(expRight) {
							resolve(expRight);
						}, function(e) {
							reject(e);
						});
					}, CONSTANTS.CodeInstructionRunTime)
				});
				
				p.then(function(expRight) {
					console.log("Right side of assign operation resolved with value: " + expRight);
					try {
						env.set(exp.left.value, expRight);
					} catch (e) {
						throw new Error("|" + workerScript.serverIp + "|" + workerScript.name + "|" + e.toString());
					}
					console.log("Assign operation finished");
					resolve("assignFinished");
				}, function(e) {
					reject(e);
				});
			});
			
		case "binary":
			console.log("Binary operation called");
			return new Promise(function(resolve, reject) {
				if (env.stopFlag) {reject(workerScript);}
				
				var pLeft = new Promise(function(resolve, reject) {
					setTimeout(function() {
						var promise = evaluate(exp.left, workerScript);
						promise.then(function(valLeft) {
							resolve(valLeft);
						}, function(e) {
							reject(e);
						});
					}, CONSTANTS.CodeInstructionRunTime);
				});
			
				pLeft.then(function(valLeft) {
					var pRight = new Promise(function(resolve, reject) {
						setTimeout(function() {
							var promise = evaluate(exp.right, workerScript);
							promise.then(function(valRight) {
								resolve([valLeft, valRight]);
							}, function(e) {
								reject(e);
							});
						}, CONSTANTS.CodeInstructionRunTime);
					});
				
					pRight.then(function(args) {
						console.log("Resolving binary operation");
						try {
							resolve(apply_op(exp.operator, args[0], args[1]));
						} catch (e) {
							reject("|" + workerScript.serverIp + "|" + workerScript.name + "|" + e.toString());
						}
					}, function(e) {
						reject(e);
					});
				}, function(e) {
					reject(e);
				});
			});
			break;

		//TODO
		case "if":
			var numConds = exp.cond.length;
			var numThens = exp.then.length;
			if (numConds == 0 || numThens == 0 || numConds != numThens) {
				throw new Error ("|" + workerScript.serverIp + "|" + workerScript.name + "|Number of conds and thens in if structure don't match (or there are none)");
			}
			
			for (var i = 0; i < numConds; i++) {
				var cond = evaluate(exp.cond[i], workerScript);
				if (cond) return evaluate(exp.then[i], workerScript);
			}
			
			//Evaluate else if it exists, snce none of the conditionals
			//were true
			return exp.else ? evaluate(exp.else, workerScript) : false;
				
		case "for":
			return new Promise(function(resolve, reject) {
				if (env.stopFlag) {reject(workerScript);}
				
				console.log("for loop encountered in evaluator");
				var pInit = new Promise(function(resolve, reject) {
					setTimeout(function() {
						var resInit = evaluate(exp.init, workerScript);
						resInit.then(function(foo) {
							resolve(resInit);
						}, function(e) {
							reject(e);
						});
					}, CONSTANTS.CodeInstructionRunTime);
				});

				pInit.then(function(expInit) {
					var pForLoop = evaluateFor(exp, workerScript);
					pForLoop.then(function(forLoopRes) {
						resolve("forLoopDone");
					}, function(e) {
						reject(e);
					});
				}, function(e) {
					reject(e);
				});
			});
			break;
		case "while":
			console.log("Evaluating while loop");
			return new Promise(function(resolve, reject) {
				if (env.stopFlag) {reject(workerScript);}
				
				var pEvaluateWhile = evaluateWhile(exp, workerScript);
				pEvaluateWhile.then(function(whileLoopRes) {
					resolve("whileLoopDone");
				}, function(e) {
					reject(e);
				});
			});
			break;
		case "prog":
			return new Promise(function(resolve, reject) {
				if (env.stopFlag) {reject(workerScript);}
				
				var evaluateProgPromise = evaluateProg(exp, workerScript, 0);
				evaluateProgPromise.then(function(w) {
					resolve(workerScript);
				}, function(e) {
					reject(e);
				});
			});
			break;

		/* Currently supported function calls:
		 * 		hack()
		 *		sleep(N) - sleep N seconds
		 *		print(x) - Prints a variable or constant
		 *
		 */
		case "call":
			//Define only valid function calls here, like hack() and stuff
			//var func = evaluate(exp.func, env);
			//return func.apply(null, exp.args.map(function(arg){
			//	return evaluate(arg, env);
			//}));
			return new Promise(function(resolve, reject) {
				if (env.stopFlag) {reject(workerScript);}
				
				setTimeout(function() {
					if (exp.func.value == "hack") {
						console.log("Execute hack()");
						if (exp.args.length != 1) {
							throw new Error("|" + workerScript.serverIp + "|" + workerScript.name + "|Hack() call has incorrect number of arguments. Takes 1 argument");
						}
						
						//IP of server to hack
						var ipPromise = evaluate(exp.args[0], workerScript);
						
						ipPromise.then(function(ip) {
                            //Check if its a valid IP address. If it's not, assume its a hostname and
                            //try to get the server. If its not a server, there is an error
                            var server = null;
                            if (!isValidIPAddress(ip)) {
                                //It's not an IP address, so see if its a hostanme
                                server = GetServerByHostname(ip);
                            } else {
                                server = AllServers[ip];
                            }
                            if (server == null) {
                                resolve("Invalid IP or server hostname passed in");
                                workerScript.scriptRef.log("Cannot hack(). Invalid IP or hostname passed in: " + ip);
                            }
                            
							//Calculate the hacking time 
							var hackingTime = scriptCalculateHackingTime(server); //This is in seconds
							
							if (server.hasAdminRights == false) {
								console.log("Cannot hack server " + server.hostname);
								resolve("Cannot hack, no admin rights");
								workerScript.scriptRef.log("Cannot hack this server because user does not have root access");
							}
                            
                            workerScript.scriptRef.log("Attempting to hack " + ip + " in " + hackingTime + " seconds");
							
							var p = new Promise(function(resolve, reject) {
								if (env.stopFlag) {reject(workerScript);}
								console.log("Hacking " + server.hostname + " after " + hackingTime.toString() + " seconds.");
								setTimeout(function() {
									var hackChance = scriptCalculateHackingChance(server);
									var rand = Math.random();
									var expGainedOnSuccess = scriptCalculateExpGain(server);
									var expGainedOnFailure = Math.round(expGainedOnSuccess / 4);
									if (rand < hackChance) {	//Success!
										var moneyGained = scriptCalculatePercentMoneyHacked(server);
										moneyGained = Math.floor(server.moneyAvailable * moneyGained);
										
										//Safety check
										if (moneyGained <= 0) {moneyGained = 0;}
										
										server.moneyAvailable -= moneyGained;
										Player.gainMoney(moneyGained);
										workerScript.scriptRef.onlineMoneyMade += moneyGained;
										
										Player.hacking_exp += expGainedOnSuccess;
										workerScript.scriptRef.onlineExpGained += expGainedOnSuccess;
										console.log("Script successfully hacked " + server.hostname + " for $" + moneyGained + " and " + expGainedOnSuccess +  " exp");
                                        workerScript.scriptRef.log("Script successfully hacked " + server.hostname + " for $" + moneyGained + " and " + expGainedOnSuccess +  " exp");
										resolve("Hack success");
									} else {			
										//Player only gains 25% exp for failure? TODO Can change this later to balance
										Player.hacking_exp += expGainedOnFailure;
										workerScript.scriptRef.onlineExpGained += expGainedOnFailure;
										
										console.log("Script unsuccessful to hack " + server.hostname + ". Gained " + expGainedOnFailure + " exp");
                                        workerScript.scriptRef.log("Script unsuccessful to hack " + server.hostname + ". Gained " + expGainedOnFailure + " exp");
										resolve("Hack failure");
									}
								}, hackingTime * 1000);
							});
							
							p.then(function(res) {
								resolve("hackExecuted");
							}, function(e) {
								reject(e);
							});
						}, function(e) {
							reject(e);
						});

					} else if (exp.func.value == "sleep") {
						console.log("Execute sleep()");
						if (exp.args.length != 1) {
							throw new Error("|" + workerScript.serverIp + "|" + workerScript.name + "|Sleep() call has incorrect number of arguments. Takes 1 argument.");
						}
						
						var sleepTimePromise = evaluate(exp.args[0], workerScript);
						sleepTimePromise.then(function(sleepTime) {
							console.log("Sleep time: " + sleepTime);
                            workerScript.scriptRef.log("Sleeping for " + sleepTime + " milliseconds");
							var p = new Promise(function(resolve, reject) {
								setTimeout(function() {
									resolve("foo");
								}, sleepTime);
							});
						
							p.then(function(res) {
								resolve("sleepExecuted");
							}, function(e) {
								reject(e);
							});
						}, function(e) {
							reject(e)
						});

						
					} else if (exp.func.value == "print") {
						if (exp.args.length != 1) {
							throw new Error("|" + workerScript.serverIp + "|" + workerScript.name + "| Print() call has incorrect number of arguments. Takes 1 argument");
						}
						
						var p = new Promise(function(resolve, reject) {
							setTimeout(function() {
								var evaluatePromise = evaluate(exp.args[0], workerScript);
								evaluatePromise.then(function(res) {
									resolve(res);
								}, function(e) {
									reject(e);
								});
							}, CONSTANTS.CodeInstructionRunTime);
						});
					
						p.then(function(res) {
							post(res.toString());
							console.log("Print call executed");
							resolve("printExecuted");
						}, function(e) {
							reject(e);
						});
					}
				}, CONSTANTS.CodeInstructionRunTime);
			});
			break;

		default:
			throw new Error("|" + workerScript.serverIp + "|" + workerScript.name + "| Can't evaluate type " + exp.type);
    }
}

//Evaluate the looping part of a for loop (Initialization block is NOT done in here)
function evaluateFor(exp, workerScript) {
	var env = workerScript.env;
	console.log("evaluateFor() called");
	return new Promise(function(resolve, reject) {
		if (env.stopFlag) {reject(workerScript);}
		
		var pCond = new Promise(function(resolve, reject) {
			setTimeout(function() {
				var evaluatePromise = evaluate(exp.cond, workerScript);
				evaluatePromise.then(function(resCond) {
					console.log("Conditional evaluated to: " + resCond);
					resolve(resCond);
				}, function(e) {
					reject(e);
				});
			}, CONSTANTS.CodeInstructionRunTime);
		});
		
		pCond.then(function(resCond) {
			if (resCond) {
				console.log("About to evaluate an iteration of for loop code");
				//Run the for loop code
				var pCode = new Promise(function(resolve, reject) {
					setTimeout(function() {
						var evaluatePromise = evaluate(exp.code, workerScript);
						evaluatePromise.then(function(resCode) {
							console.log("Evaluated an iteration of for loop code");
							resolve(resCode);
						}, function(e) {
							reject(e);
						});
					}, CONSTANTS.CodeInstructionRunTime);
				});
				
				//After the code executes make a recursive call
				pCode.then(function(resCode) {
					var pPostLoop = new Promise(function(resolve, reject) {
						setTimeout(function() {
							var evaluatePromise = evaluate(exp.postloop, workerScript);
							evaluatePromise.then(function(foo) {
								console.log("Evaluated for loop postloop");
								resolve("postLoopFinished");
							}, function(e) {
								reject(e);
							});
						}, CONSTANTS.CodeInstructionRunTime);
					});
					
					pPostLoop.then(function(resPostloop) {
						var recursiveCall = evaluateFor(exp, workerScript);
						recursiveCall.then(function(foo) {
							resolve("endForLoop");
						}, function(e) {
							reject(e);
						});
					}, function(e) {
						reject(e);
					});

				}, function(e) {
					reject(e);
				});
			} else {
				console.log("Cond is false, stopping for loop");
				resolve("endForLoop");	//Doesn't need to resolve to any particular value
			}
		}, function(e) {
			reject(e);
		});
	});
}

function evaluateWhile(exp, workerScript) {
	var env = workerScript.env;
	
	console.log("evaluateWhile() called");
	return new Promise(function(resolve, reject) {
		if (env.stopFlag) {reject(workerScript);}
		
		var pCond = new Promise(function(resolve, reject) {
			setTimeout(function() {
				var evaluatePromise = evaluate(exp.cond, workerScript);
				evaluatePromise.then(function(resCond) {
					console.log("Conditional evaluated to: " + resCond);
					resolve(resCond);
				}, function(e) {
					reject(e);	
				});
			}, CONSTANTS.CodeInstructionRunTime);
		});
		
		pCond.then(function(resCond) {
			if (resCond) {
				//Run the while loop code
				var pCode = new Promise(function(resolve, reject) {
					setTimeout(function() {
						var evaluatePromise = evaluate(exp.code, workerScript);
						evaluatePromise.then(function(resCode) {
							console.log("Evaluated an iteration of while loop code");
							resolve(resCode);
						}, function(e) {
							reject(e);
						});
					}, CONSTANTS.CodeInstructionRunTime);
				});
				
				//After the code executes make a recursive call
				pCode.then(function(resCode) {
					var recursiveCall = evaluateWhile(exp, workerScript);
					recursiveCall.then(function(foo) {
						resolve("endWhileLoop");
					}, function(e) {
						reject(e);
					});
				}, function(e) {
					reject(e);
				});
			} else {
				console.log("Cond is false, stopping while loop");
				resolve("endWhileLoop");	//Doesn't need to resolve to any particular value
			}
		}, function(e) {
			reject(e);
		});
	});
}

function evaluateProg(exp, workerScript, index) {
	var env = workerScript.env;
	
	console.log("evaluateProg() called");
	return new Promise(function(resolve, reject) {
		if (env.stopFlag) {reject(workerScript);}
		
		if (index >= exp.prog.length) {
			console.log("Prog done. Resolving recursively");
			resolve("progFinished");
		} else {
			//Evaluate this line of code in the prog
			var code = new Promise(function(resolve, reject) {
				setTimeout(function() {
					var evaluatePromise = evaluate(exp.prog[index], workerScript); 
					evaluatePromise.then(function(evalRes) {
						resolve(evalRes);
					}, function(e) {
						reject(e);
					});
				}, CONSTANTS.CodeInstructionRunTime);
			});
			
			//After the code finishes evaluating, evaluate the next line recursively
			code.then(function(codeRes) {
				var nextLine = evaluateProg(exp, workerScript, index + 1);
				nextLine.then(function(nextLineRes) {
					resolve(workerScript);
				}, function(e) {
					reject(e);
				});
			}, function(e) {
				reject(e);
			});
		}
	});
}

function apply_op(op, a, b) {
    function num(x) {
        if (typeof x != "number")
            throw new Error("Expected number but got " + x);
        return x;
    }
    function div(x) {
        if (num(x) == 0)
            throw new Error("Divide by zero");
        return x;
    }
    switch (op) {
      case "+": return num(a) + num(b);
      case "-": return num(a) - num(b);
      case "*": return num(a) * num(b);
      case "/": return num(a) / div(b);
      case "%": return num(a) % div(b);
      case "&&": return a !== false && b;
      case "||": return a !== false ? a : b;
      case "<": return num(a) < num(b);
      case ">": return num(a) > num(b);
      case "<=": return num(a) <= num(b);
      case ">=": return num(a) >= num(b);
      case "==": return a === b;
      case "!=": return a !== b;
    }
    throw new Error("Can't apply operator " + op);
} 

//The same as Player's calculateHackingChance() function but takes in the server as an argument
function scriptCalculateHackingChance(server) {
	var difficultyMult = (100 - server.hackDifficulty) / 100;
    var skillMult = (Player.hacking_chance_mult * Player.hacking_skill);
    var skillChance = (skillMult - server.requiredHackingSkill) / skillMult;
    var chance = skillChance * difficultyMult;
    if (chance < 0) {return 0;}
    else {return chance;}
}

//The same as Player's calculateHackingTime() function but takes in the server as an argument
function scriptCalculateHackingTime(server) {
	var difficultyMult = server.requiredHackingSkill * server.hackDifficulty;
	var skillFactor = (difficultyMult + 1000) / (Player.hacking_skill + 50);
	var hackingTime = skillFactor * Player.hacking_speed_mult; //This is in seconds
	return hackingTime;
}

//The same as Player's calculateExpGain() function but takes in the server as an argument 
function scriptCalculateExpGain(server) {
	return Math.round(server.hackDifficulty * server.requiredHackingSkill * Player.hacking_exp_mult);
}

//The same as Player's calculatePercentMoneyHacked() function but takes in the server as an argument
function scriptCalculatePercentMoneyHacked(server) {
	var difficultyMult = (100 - server.hackDifficulty) / 100;
    var skillMult = (Player.hacking_skill - (server.requiredHackingSkill - 1)) / Player.hacking_skill;
    var percentMoneyHacked = difficultyMult * skillMult * Player.hacking_money_mult;
    console.log("Percent money hacked calculated to be: " + percentMoneyHacked);
    return percentMoneyHacked;
} 