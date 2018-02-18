dirs=(
MemoryAccess/BasicTest
MemoryAccess/PointerTest
MemoryAccess/StaticTest
StackArithmetic/SimpleAdd
StackArithmetic/StackTest
ProgramFlow/BasicLoop
ProgramFlow/FibonacciSeries
FunctionCalls/SimpleFunction
)

for dir in ${dirs[@]}
do
  node --experimental-modules trans.mjs $dir
  if [ $? != 0 ]
  then
    echo 'TRANSLATION DID NOT FINISH'
    break
  fi
done
